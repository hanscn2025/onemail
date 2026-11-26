// IMAP 收信(可选升级):给独立部署的 imap-bridge 网关用的接口，以及管理中心里的开关。
// Workers 不能监听 TCP 端口，所以 IMAP 协议由网关处理；网关不存信，每条命令都回到这里读写 D1 / R2。
// 没开 IMAP 服务时，/api/gw/* 一律拒绝，其余功能不受影响。
import PostalMime from 'postal-mime';
import { connect } from 'cloudflare:sockets';
import { verifyPassword, makeToken, userFromToken, checkLocked, recordFail, clearFail, timingSafeEqual } from './auth.js';
import { saveSetting, getSetting, ensureImapSchema, IMAP_RELEASED } from './config.js';
import { addLog, store } from './mail.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const err = (msg, status = 400) => json({ error: msg }, status);

const FOLDERS = ['inbox', 'sent', 'drafts', 'trash', 'starred'];
const MAX_APPEND = 25 * 1024 * 1024;
const MAX_BATCH = 50;
const HOST_RE = /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(:\d{1,5})?$/;

const randomHex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');

// 文件夹条件：星标是虚拟文件夹(不含垃圾箱里的)
function folderWhere(folder) {
  return folder === 'starred' ? `starred = 1 AND folder != 'trash'` : 'folder = ?2';
}
const folderArgs = (box, folder) => (folder === 'starred' ? [box] : [box, folder]);

const parseUids = (s) => [...new Set(String(s || '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0))];

async function uidValidity(env) {
  let v = await getSetting(env, 'imap_uidvalidity');
  if (!v) { v = String(Math.floor(Date.now() / 1000)); await saveSetting(env, 'imap_uidvalidity', v); }
  return Number(v);
}

async function boxVer(env, box) {
  return (await env.DB.prepare('SELECT v FROM mbox_ver WHERE mailbox = ?').bind(box).first())?.v || 0;
}

// 按邮箱算：别的账号收信不会让这里的 UIDNEXT 变化(客户端据此判断有没有新信)
async function uidNext(env, box) {
  return ((await env.DB.prepare('SELECT COALESCE(MAX(uid), 0) AS n FROM messages WHERE mailbox = ?').bind(box).first()).n || 0) + 1;
}

// 按 UID 取一批信(只取当前文件夹里的，防止越权)
async function rowsByUid(env, box, folder, uids, cols = '*') {
  if (!uids.length) return [];
  const r = await env.DB.prepare(
    `SELECT ${cols} FROM messages WHERE mailbox = ?1 AND ${folderWhere(folder)} AND uid IN (${uids.map(() => '?').join(',')})`
  ).bind(...folderArgs(box, folder), ...uids).all();
  return r.results;
}

// ---------- 没有原文的信(网页发出的、网页存的草稿):按数据库内容生成一封标准 EML ----------
const CRLF = '\r\n';
const b64 = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/.{76}/g, '$&' + CRLF);
};
const encWord = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(new TextEncoder().encode(s)).replace(/\r\n/g, '')}?=`);
const addrHdr = (list) => list.map((a) => (a.name ? `${encWord(a.name)} <${a.address}>` : a.address)).join(', ');
const quoteParam = (s) => (/^[\x20-\x7e]*$/.test(s) ? `"${s.replace(/["\\]/g, '_')}"` : `"${encWord(s)}"`);

async function buildEml(env, m) {
  const obj = await env.BUCKET.get(`body/${m.id}.json`);
  const body = obj ? await obj.json() : { text: '', html: '' };
  const to = JSON.parse(m.to_json || '[]'), cc = JSON.parse(m.cc_json || '[]');
  const atts = JSON.parse(m.attach_json || '[]');
  const boundary = `=_onemail_${m.id.replace(/-/g, '')}`;
  const h = [
    `From: ${addrHdr([{ name: m.from_name, address: m.from_addr }])}`,
    to.length ? `To: ${addrHdr(to)}` : '',
    cc.length ? `Cc: ${addrHdr(cc)}` : '',
    `Subject: ${encWord(m.subject || '')}`,
    `Date: ${new Date(m.date).toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: ${m.message_id || `<${m.id}@onemail>`}`,
    m.in_reply_to ? `In-Reply-To: ${m.in_reply_to}` : '',
    m.refs ? `References: ${m.refs}` : '',
    'MIME-Version: 1.0',
  ].filter(Boolean);
  const textPart = (type, s) => `Content-Type: ${type}; charset=UTF-8${CRLF}Content-Transfer-Encoding: base64${CRLF}${CRLF}${b64(new TextEncoder().encode(s || ''))}`;
  const main = body.html ? `Content-Type: multipart/alternative; boundary="${boundary}_alt"${CRLF}${CRLF}--${boundary}_alt${CRLF}${textPart('text/plain', body.text)}${CRLF}--${boundary}_alt${CRLF}${textPart('text/html', body.html)}${CRLF}--${boundary}_alt--`
    : textPart('text/plain', body.text);
  if (!atts.length) return new TextEncoder().encode(h.join(CRLF) + CRLF + main + CRLF);
  const parts = [main];
  for (const a of atts) {
    const o = await env.BUCKET.get(`att/${m.id}/${a.i}`);
    const bytes = o ? new Uint8Array(await o.arrayBuffer()) : new Uint8Array();
    parts.push(`Content-Type: ${a.type || 'application/octet-stream'}; name=${quoteParam(a.filename)}${CRLF}Content-Disposition: ${a.inline ? 'inline' : 'attachment'}; filename=${quoteParam(a.filename)}${CRLF}${a.cid ? `Content-ID: <${a.cid}>${CRLF}` : ''}Content-Transfer-Encoding: base64${CRLF}${CRLF}${b64(bytes)}`);
  }
  return new TextEncoder().encode(`${h.join(CRLF)}${CRLF}Content-Type: multipart/mixed; boundary="${boundary}"${CRLF}${CRLF}${parts.map((p) => `--${boundary}${CRLF}${p}${CRLF}`).join('')}--${boundary}--${CRLF}`);
}

// 取原文；没有就生成一份存进 R2,并把大小改成原文大小(IMAP 的 RFC822.SIZE 要和实际一致)
async function rawOf(env, m) {
  const obj = await env.BUCKET.get(`raw/${m.id}.eml`);
  if (obj) return new Uint8Array(await obj.arrayBuffer());
  const bytes = await buildEml(env, m);
  await env.BUCKET.put(`raw/${m.id}.eml`, bytes, { httpMetadata: { contentType: 'message/rfc822' } });
  if (m.size !== bytes.byteLength) await env.DB.prepare('UPDATE messages SET size = ? WHERE id = ?').bind(bytes.byteLength, m.id).run();
  return bytes;
}

// 只取信头：原文前 64KB 截到第一个空行
async function headerOf(env, m) {
  const obj = await env.BUCKET.get(`raw/${m.id}.eml`, { range: { offset: 0, length: 65536 } });
  const bytes = obj ? new Uint8Array(await obj.arrayBuffer()) : await rawOf(env, m);
  // 逐字节转成字符串(0-255),网关用 latin1 还原成原始字节；TextDecoder 的 latin1 实际是 windows-1252,会改字节
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const i = s.search(/\r?\n\r?\n/);
  return i < 0 ? s : s.slice(0, i) + '\r\n\r\n';
}

async function deleteObjects(env, m) {
  const keys = [`raw/${m.id}.eml`, `body/${m.id}.json`];
  for (const a of JSON.parse(m.attach_json || '[]')) keys.push(`att/${m.id}/${a.i}`);
  await env.BUCKET.delete(keys);
}

// ---------- 网关接口 /api/gw/* ----------
export async function gwRoutes(path, method, request, env, url) {
  if (!path.startsWith('/gw/')) return null;
  if (!env.IMAP_ON || !env.IMAP_KEY) return err('IMAP 服务未启用', 403);
  if (!timingSafeEqual(request.headers.get('X-Gateway-Key') || '', env.IMAP_KEY)) return err('网关密钥无效', 403);

  // 网关启动时和每 5 分钟报到一次，管理中心据此显示连接状态
  if (path === '/gw/ping' && method === 'POST') {
    const b = await request.json().catch(() => ({}));
    await saveSetting(env, 'imap_gw_seen', JSON.stringify({ at: Date.now(), version: String(b.version || '').slice(0, 20), host: String(b.host || '').slice(0, 253) }));
    return json({ ok: true, name: (await getSetting(env, 'brand_name')) || 'OneMail', uidvalidity: await uidValidity(env) });
  }

  // 用 OneMail 账号密码登录，换一个令牌；客户端 IP 由网关转交，失败次数按 IP 和账号分别计
  if (path === '/gw/login' && method === 'POST') {
    const { address, password, ip, client } = await request.json().catch(() => ({}));
    const addr = String(address || '').trim().toLowerCase();
    const cip = String(ip || '').slice(0, 64) || 'gateway';
    const keys = [`imap:${cip}`, `u:${addr}`];
    if (await checkLocked(env, keys)) return err('登录失败次数过多，请 15 分钟后重试', 429);
    const u = await env.DB.prepare('SELECT * FROM users WHERE address = ?').bind(addr).first();
    if (!u || !(await verifyPassword(String(password || ''), u.pass_hash))) {
      await recordFail(env, keys);
      await addLog(env, 'login_fail', addr, '', 'IMAP：密码错误或账号不存在', cip);
      return err('邮箱或密码错误', 401);
    }
    if (u.disabled) { await addLog(env, 'login_fail', addr, '', 'IMAP：账号已停用', cip); return err('该账号已被停用', 403); }
    await clearFail(env, keys);
    await env.DB.prepare('UPDATE users SET last_login = ? WHERE id = ?').bind(Date.now(), u.id).run();
    await addLog(env, 'login', addr, '', `IMAP 客户端${client ? '：' + String(client).slice(0, 60) : ''}`, cip);
    return json({ token: await makeToken(env, u), address: u.address });
  }

  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const user = await userFromToken(env, token);
  if (!user) return err('登录已失效', 401);
  const box = user.address;
  const folder = url.searchParams.get('folder') || 'inbox';
  if (!FOLDERS.includes(folder)) return err('folder');

  // 邮箱版本号：网关轮询用，只读一行
  if (path === '/gw/ver' && method === 'GET') return json({ v: await boxVer(env, box) });

  // 各文件夹的数量、未读、UIDNEXT(STATUS / LIST 用)
  if (path === '/gw/folders' && method === 'GET') {
    const v = await boxVer(env, box); // 先读版本号：读完数据前又有变化时，下次轮询会发现
    const r = await env.DB.prepare(
      `SELECT folder, COUNT(*) AS total, SUM(1 - seen) AS unseen FROM messages WHERE mailbox = ? GROUP BY folder`
    ).bind(box).all();
    const st = await env.DB.prepare(`SELECT COUNT(*) AS total, SUM(1 - seen) AS unseen FROM messages WHERE mailbox = ? AND starred = 1 AND folder != 'trash'`).bind(box).first();
    const out = Object.fromEntries(FOLDERS.map((f) => [f, { total: 0, unseen: 0 }]));
    for (const x of r.results) if (out[x.folder]) out[x.folder] = { total: x.total, unseen: x.unseen || 0 };
    out.starred = { total: st.total, unseen: st.unseen || 0 };
    return json({ v, folders: out, uidvalidity: await uidValidity(env), uidnext: await uidNext(env, box) });
  }

  // 一个文件夹的全部信：[uid, 标志位(1 已读 2 星标), 大小, 时间]，按 UID 升序
  if (path === '/gw/list' && method === 'GET') {
    const v = await boxVer(env, box);
    const r = await env.DB.prepare(
      `SELECT uid, seen, starred, size, date FROM messages WHERE mailbox = ?1 AND ${folderWhere(folder)} AND uid IS NOT NULL ORDER BY uid`
    ).bind(...folderArgs(box, folder)).all();
    return json({
      v, uidvalidity: await uidValidity(env), uidnext: await uidNext(env, box),
      items: r.results.map((x) => [x.uid, (x.seen ? 1 : 0) | (x.starred ? 2 : 0), x.size, x.date]),
    });
  }

  // 搜索用的摘要信息；uids 留空表示整个文件夹
  if (path === '/gw/meta' && method === 'GET') {
    const uids = parseUids(url.searchParams.get('uids'));
    const cols = 'uid, from_addr, from_name, to_json, cc_json, subject, snippet';
    const rows = uids.length ? await rowsByUid(env, box, folder, uids, cols)
      : (await env.DB.prepare(`SELECT ${cols} FROM messages WHERE mailbox = ?1 AND ${folderWhere(folder)}`).bind(...folderArgs(box, folder)).all()).results;
    return json({ items: rows.map((x) => ({ uid: x.uid, from: `${x.from_name} ${x.from_addr}`, to: x.to_json, cc: x.cc_json, subject: x.subject, text: x.snippet })) });
  }

  // 一批信的信头(最多 50 封)
  if (path === '/gw/headers' && method === 'GET') {
    const uids = parseUids(url.searchParams.get('uids')).slice(0, MAX_BATCH);
    const out = {};
    for (const m of await rowsByUid(env, box, folder, uids)) out[m.uid] = await headerOf(env, m);
    return json({ items: out });
  }

  // 一封信的完整原文
  if (path === '/gw/raw' && method === 'GET') {
    const [m] = await rowsByUid(env, box, folder, parseUids(url.searchParams.get('uid')).slice(0, 1));
    if (!m) return err('邮件不存在', 404);
    return new Response(await rawOf(env, m), { headers: { 'Content-Type': 'message/rfc822', 'Cache-Control': 'no-store' } });
  }

  if (method !== 'POST') return err('not found', 404);
  const b = await request.json().catch(() => ({}));
  const uids = (Array.isArray(b.uids) ? b.uids : []).map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 5000);

  // 已读、星标
  if (path === '/gw/flags') {
    const rows = await rowsByUid(env, box, folder, uids, 'id');
    const sets = [];
    if ('seen' in b) sets.push(`seen = ${b.seen ? 1 : 0}`);
    if ('starred' in b) sets.push(`starred = ${b.starred ? 1 : 0}`);
    if (sets.length && rows.length) {
      const stmts = rows.map((x) => env.DB.prepare(`UPDATE messages SET ${sets.join(', ')} WHERE id = ?`).bind(x.id));
      for (let i = 0; i < stmts.length; i += 100) await env.DB.batch(stmts.slice(i, i + 100));
    }
    return json({ ok: true, n: rows.length });
  }

  // 移动：到垃圾箱 = 网页上的删除；从垃圾箱移出 = 恢复；到星标 = 加星标(信不离开原文件夹)
  // 返回 [旧 UID, 新 UID],网关据此回 COPYUID
  if (path === '/gw/move') {
    const to = String(b.to || '');
    if (!FOLDERS.includes(to)) return err('目标文件夹无效');
    const rows = await rowsByUid(env, box, folder, uids, 'id, uid, folder');
    if (to === 'starred') {
      const stmts = rows.map((x) => env.DB.prepare('UPDATE messages SET starred = 1 WHERE id = ?').bind(x.id));
      for (let i = 0; i < stmts.length; i += 100) await env.DB.batch(stmts.slice(i, i + 100));
      return json({ map: rows.map((x) => [x.uid, x.uid]) });
    }
    const stmts = rows.filter((x) => x.folder !== to).map((x) => to === 'trash'
      ? env.DB.prepare(`UPDATE messages SET prev_folder = folder, folder = 'trash', moved_at = ? WHERE id = ?`).bind(Date.now(), x.id)
      : env.DB.prepare('UPDATE messages SET folder = ?, moved_at = NULL WHERE id = ?').bind(to, x.id));
    for (let i = 0; i < stmts.length; i += 100) await env.DB.batch(stmts.slice(i, i + 100));
    const after = rows.length ? (await env.DB.prepare(`SELECT id, uid FROM messages WHERE id IN (${rows.map(() => '?').join(',')})`).bind(...rows.map((x) => x.id)).all()).results : [];
    const nu = new Map(after.map((x) => [x.id, x.uid]));
    return json({ map: rows.map((x) => [x.uid, nu.get(x.id)]) });
  }

  // 彻底删除(EXPUNGE):垃圾箱、草稿里的直接删；星标里的取消星标；其他文件夹的移到垃圾箱，和网页上一致
  if (path === '/gw/expunge') {
    const rows = await rowsByUid(env, box, folder, uids, 'id, uid, folder, attach_json');
    for (const m of rows) {
      if (folder === 'starred') await env.DB.prepare('UPDATE messages SET starred = 0 WHERE id = ?').bind(m.id).run();
      else if (m.folder === 'trash' || m.folder === 'drafts') {
        await deleteObjects(env, m);
        await env.DB.prepare('DELETE FROM messages WHERE id = ?').bind(m.id).run();
      } else await env.DB.prepare(`UPDATE messages SET prev_folder = folder, folder = 'trash', moved_at = ? WHERE id = ?`).bind(Date.now(), m.id).run();
    }
    return json({ ok: true, n: rows.length });
  }

  return err('not found', 404);
}

// APPEND:客户端把发出的信存进「已发送」、保存草稿等。请求体是原始 EML,参数放在网址里
export async function gwAppend(request, env, url) {
  if (!env.IMAP_ON || !env.IMAP_KEY || !timingSafeEqual(request.headers.get('X-Gateway-Key') || '', env.IMAP_KEY)) return err('网关密钥无效', 403);
  const user = await userFromToken(env, (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''));
  if (!user) return err('登录已失效', 401);
  let folder = url.searchParams.get('folder') || 'inbox';
  const starred = url.searchParams.get('starred') === '1' || folder === 'starred';
  if (folder === 'starred') folder = 'inbox';
  if (!['inbox', 'sent', 'drafts'].includes(folder)) return err('该文件夹不支持存入邮件');
  const raw = new Uint8Array(await request.arrayBuffer());
  if (!raw.byteLength) return err('邮件内容为空');
  if (raw.byteLength > MAX_APPEND) return err('邮件不能超过 25MB', 413);
  const q = await env.DB.prepare('SELECT quota_mb, (SELECT COALESCE(SUM(size), 0) FROM messages WHERE mailbox = users.address) AS used FROM users WHERE id = ?').bind(user.id).first();
  if (q?.quota_mb && q.used + raw.byteLength > q.quota_mb * 1048576) return err('邮箱空间已满', 507);
  const p = await PostalMime.parse(raw);
  const date = Number(url.searchParams.get('date')) || (p.date ? Date.parse(p.date) : 0) || Date.now();
  const id = await store(env, user.address, p, raw, { from: p.from?.address || user.address, rawSize: raw.byteLength }, {
    folder, seen: url.searchParams.get('seen') === '1' || folder !== 'inbox', starred, date,
  });
  const r = await env.DB.prepare('SELECT uid FROM messages WHERE id = ?').bind(id).first();
  return json({ uid: r.uid, uidvalidity: await uidValidity(env) });
}

// ---------- 管理中心：IMAP 服务(可选) ----------
function seenInfo(s) {
  try { return s ? JSON.parse(s) : null; } catch { return null; }
}

// 测试连接：从 Cloudflare 连到网关的 993 端口，读 IMAP 欢迎语
async function probe(host) {
  const [name, port = '993'] = host.split(':');
  let sock;
  try {
    sock = connect({ hostname: name, port: Number(port) }, { secureTransport: 'on' });
    const reader = sock.readable.getReader();
    const timer = new Promise((_, rej) => setTimeout(() => rej(new Error('连接超时')), 8000));
    const { value } = await Promise.race([reader.read(), timer]);
    const greet = new TextDecoder().decode(value || new Uint8Array()).trim();
    if (!/^\* OK/.test(greet)) return { ok: false, detail: `已连接，但返回的不是 IMAP 欢迎语：${greet.slice(0, 80)}` };
    if (!/OneMail/i.test(greet)) return { ok: false, detail: `已连接，但对方不是 OneMail 网关：${greet.slice(0, 80)}` };
    return { ok: true, detail: greet.slice(0, 120) };
  } catch (e) {
    return { ok: false, detail: `无法连接 ${name}:${port}（${e.message}），请检查网关是否运行、端口是否开放、证书是否有效` };
  } finally {
    try { await sock?.close(); } catch {}
  }
}

export async function imapAdmin(path, method, request, env) {
  if (path === '/admin/imap' && method === 'GET') {
    return json({ released: IMAP_RELEASED, on: !!env.IMAP_ON, host: env.IMAP_HOST || '', key: env.IMAP_KEY || '', seen: seenInfo(await getSetting(env, 'imap_gw_seen')) });
  }
  if (path === '/admin/imap' && method === 'POST') {
    const b = await request.json().catch(() => ({}));
    if (b.on === false) {
      // 关闭时作废密钥，已部署的网关随即无法访问
      for (const k of ['imap_on', 'imap_gw_key', 'imap_gw_seen']) await saveSetting(env, k, null);
      return json({ ok: true, note: '已停用 IMAP 服务' });
    }
    if (!IMAP_RELEASED) return err('IMAP 服务尚未开放');
    const host = String(b.host || '').trim().toLowerCase().replace(/^imaps?:\/\//, '').replace(/\/.*$/, '');
    if (!HOST_RE.test(host)) return err('网关地址格式无效，例如 imap.example.com');
    await ensureImapSchema(env); // 第一次启用时给信件加 UID(之前没开过的部署不建这些表和触发器)
    await saveSetting(env, 'imap_host', host);
    if (!env.IMAP_KEY || b.rotate) await saveSetting(env, 'imap_gw_key', randomHex(24));
    await saveSetting(env, 'imap_on', '1');
    return json({ ok: true, note: b.rotate ? '已重新生成网关密钥，请更新网关配置' : '已保存' });
  }
  if (path === '/admin/imap/test' && method === 'POST') {
    const b = await request.json().catch(() => ({}));
    const host = String(b.host || env.IMAP_HOST || '').trim().toLowerCase();
    if (!HOST_RE.test(host)) return err('网关地址格式无效，例如 imap.example.com');
    const r = await probe(host);
    const seen = seenInfo(await getSetting(env, 'imap_gw_seen'));
    return json({ ...r, seen });
  }
  return null;
}
