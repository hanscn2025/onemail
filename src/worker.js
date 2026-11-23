import {
  hashPassword, verifyPassword, makeSessionCookie, clearCookie, getSessionUser,
  checkLocked, recordFail, clearFail,
} from './auth.js';
import { receive, sendOut, snippetOf, textToHtml } from './mail.js';
import { withConfig, isConfigured, runSetup } from './config.js';

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
const err = (msg, status = 400) => json({ error: msg }, status);

const FOLDERS = ['inbox', 'sent', 'trash', 'starred'];
const EMAIL_RE = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]+$/;
const MAX_SEND_BYTES = 20 * 1024 * 1024;

const parseAddrs = (s) =>
  String(s || '').split(/[,;，；\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);

function domainsOf(env) {
  return (env.DOMAINS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

// 当前用户能看哪个邮箱:普通用户只能看自己的;管理员可以用 ?mailbox= 看别的
function boxFor(user, url) {
  const want = (url.searchParams.get('mailbox') || '').toLowerCase();
  return user.is_admin && want ? want : user.address;
}

async function loadMsg(env, user, id) {
  const m = await env.DB.prepare('SELECT * FROM messages WHERE id = ?').bind(id).first();
  if (!m) return null;
  if (m.mailbox !== user.address && !user.is_admin) return null;
  return m;
}

async function deleteMsgObjects(env, m) {
  const keys = [`raw/${m.id}.eml`, `body/${m.id}.json`];
  for (const a of JSON.parse(m.attach_json || '[]')) keys.push(`att/${m.id}/${a.i}`);
  await env.BUCKET.delete(keys);
}

function contentDisposition(name) {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

async function api(request, env, url) {
  const path = url.pathname.slice(4); // 去掉 /api
  const method = request.method;

  // 改动类请求必须带这个头;跨站页面不能随便加自定义头,用来挡 CSRF
  if (method !== 'GET' && request.headers.get('X-Mail') !== '1') return err('bad request', 403);

  // 首次设置:还没有任何账号时,网页上先创建管理员
  if (path === '/setup') {
    const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first()).n;
    if (method === 'GET') return json({ needed: n === 0 });
    if (method === 'POST') {
      if (n > 0) return err('已经设置过了,请直接登录', 409);
      const r = await runSetup(env, await request.json().catch(() => ({})), hashPassword);
      if (r.error) return err(r.error, r.status || 400);
      const cfgEnv = await withConfig(env.__raw);
      const u = await env.DB.prepare('SELECT * FROM users WHERE address = ?').bind(r.address).first();
      return json({ ok: true, address: r.address }, 200, { 'Set-Cookie': await makeSessionCookie(cfgEnv, u) });
    }
  }
  if (!isConfigured(env)) return err('还没完成首次设置', 503);

  if (path === '/login' && method === 'POST') {
    const { address, password } = await request.json().catch(() => ({}));
    const addr = String(address || '').trim().toLowerCase();
    const ip = request.headers.get('CF-Connecting-IP') || 'local';
    const keys = [`ip:${ip}`, `u:${addr}`];
    if (await checkLocked(env, keys)) return err('失败次数太多,请 15 分钟后再试', 429);
    const u = await env.DB.prepare('SELECT * FROM users WHERE address = ?').bind(addr).first();
    if (!u || !(await verifyPassword(String(password || ''), u.pass_hash))) {
      await recordFail(env, keys);
      return err('邮箱或密码不对', 401);
    }
    await clearFail(env, keys);
    return json({ ok: true }, 200, { 'Set-Cookie': await makeSessionCookie(env, u) });
  }

  const user = await getSessionUser(request, env);
  if (!user) return err('未登录', 401);

  if (path === '/logout' && method === 'POST') return json({ ok: true }, 200, { 'Set-Cookie': clearCookie });

  if (path === '/me' && method === 'GET') {
    const out = { address: user.address, name: user.name, is_admin: !!user.is_admin, domains: domainsOf(env) };
    if (user.is_admin) {
      const r = await env.DB.prepare(
        `SELECT address FROM users UNION SELECT DISTINCT mailbox FROM messages ORDER BY 1`
      ).all();
      out.mailboxes = r.results.map((x) => x.address);
    }
    return json(out);
  }

  if (path === '/counts' && method === 'GET') {
    const box = boxFor(user, url);
    const r = await env.DB.prepare(
      `SELECT folder, COUNT(*) AS n FROM messages WHERE mailbox = ? AND seen = 0 GROUP BY folder`
    ).bind(box).all();
    const out = {};
    for (const x of r.results) out[x.folder] = x.n;
    return json(out);
  }

  if (path === '/messages' && method === 'GET') {
    const box = boxFor(user, url);
    const folder = url.searchParams.get('folder') || 'inbox';
    if (!FOLDERS.includes(folder)) return err('folder');
    const q = (url.searchParams.get('q') || '').trim();
    const before = Number(url.searchParams.get('before')) || 0;
    const args = [box];
    let where = 'mailbox = ?1';
    if (folder === 'starred') where += ` AND starred = 1 AND folder != 'trash'`;
    else { args.push(folder); where += ` AND folder = ?${args.length}`; }
    if (q) {
      args.push(`%${q.replace(/[%_\\]/g, (c) => '\\' + c)}%`);
      const n = `?${args.length} ESCAPE '\\'`;
      where += ` AND (subject LIKE ${n} OR from_addr LIKE ${n} OR from_name LIKE ${n} OR snippet LIKE ${n} OR to_json LIKE ${n})`;
    }
    const rcpt = (url.searchParams.get('rcpt') || '').toLowerCase();
    if (rcpt) { args.push(rcpt); where += ` AND envelope_to = ?${args.length}`; }
    if (before) { args.push(before); where += ` AND date < ?${args.length}`; }
    const r = await env.DB.prepare(
      `SELECT id, folder, from_addr, from_name, to_json, envelope_to, subject, snippet, has_attach, seen, starred, date
       FROM messages WHERE ${where} ORDER BY date DESC LIMIT 50`
    ).bind(...args).all();
    return json({ items: r.results.map((x) => ({ ...x, to: JSON.parse(x.to_json), to_json: undefined })) });
  }

  // 这个邮箱收过信的所有地址(用于按地址筛选)
  if (path === '/recipients' && method === 'GET') {
    const r = await env.DB.prepare(
      `SELECT envelope_to AS address, COUNT(*) AS n, SUM(CASE WHEN seen = 0 THEN 1 ELSE 0 END) AS unread
       FROM messages WHERE mailbox = ? AND envelope_to IS NOT NULL AND folder != 'trash'
       GROUP BY envelope_to ORDER BY MAX(date) DESC`
    ).bind(boxFor(user, url)).all();
    return json({ items: r.results });
  }

  let m = path.match(/^\/messages\/([0-9a-f-]{36})(\/.*)?$/);
  if (m) {
    const msg = await loadMsg(env, user, m[1]);
    if (!msg) return err('没有这封信', 404);
    const sub = m[2] || '';

    if (sub === '' && method === 'GET') {
      const obj = await env.BUCKET.get(`body/${msg.id}.json`);
      const body = obj ? await obj.json() : { text: '', html: '' };
      if (!msg.seen) await env.DB.prepare('UPDATE messages SET seen = 1 WHERE id = ?').bind(msg.id).run();
      return json({
        ...msg,
        seen: 1,
        to: JSON.parse(msg.to_json),
        cc: JSON.parse(msg.cc_json),
        attachments: JSON.parse(msg.attach_json),
        text: body.text,
        html: body.html,
      });
    }

    if (sub === '' && method === 'PATCH') {
      const b = await request.json().catch(() => ({}));
      if ('seen' in b) await env.DB.prepare('UPDATE messages SET seen = ? WHERE id = ?').bind(b.seen ? 1 : 0, msg.id).run();
      if ('starred' in b) await env.DB.prepare('UPDATE messages SET starred = ? WHERE id = ?').bind(b.starred ? 1 : 0, msg.id).run();
      if (b.folder === 'trash' && msg.folder !== 'trash')
        await env.DB.prepare(`UPDATE messages SET prev_folder = folder, folder = 'trash', moved_at = ? WHERE id = ?`).bind(Date.now(), msg.id).run();
      if (b.folder === 'restore' && msg.folder === 'trash')
        await env.DB.prepare(`UPDATE messages SET folder = COALESCE(prev_folder, 'inbox'), moved_at = NULL WHERE id = ?`).bind(msg.id).run();
      return json({ ok: true });
    }

    if (sub === '' && method === 'DELETE') {
      if (msg.folder !== 'trash') return err('先移到垃圾箱');
      await deleteMsgObjects(env, msg);
      await env.DB.prepare('DELETE FROM messages WHERE id = ?').bind(msg.id).run();
      return json({ ok: true });
    }

    if (sub === '/raw' && method === 'GET') {
      const obj = await env.BUCKET.get(`raw/${msg.id}.eml`);
      if (!obj) return err('没有原始邮件', 404);
      return new Response(obj.body, {
        headers: { 'Content-Type': 'message/rfc822', 'Content-Disposition': contentDisposition(`${msg.subject || 'mail'}.eml`), 'X-Content-Type-Options': 'nosniff' },
      });
    }

    const am = sub.match(/^\/att\/(\d+)$/);
    if (am && method === 'GET') {
      const a = JSON.parse(msg.attach_json).find((x) => x.i === Number(am[1]));
      const obj = a && (await env.BUCKET.get(`att/${msg.id}/${a.i}`));
      if (!obj) return err('没有这个附件', 404);
      // 图片可以内嵌显示,其他一律下载,避免附件里的 HTML 在本站运行
      const isImg = /^image\/(png|jpe?g|gif|webp|bmp)$/i.test(a.type) && url.searchParams.get('dl') !== '1';
      return new Response(obj.body, {
        headers: {
          'Content-Type': isImg ? a.type : 'application/octet-stream',
          'Content-Disposition': isImg ? 'inline' : contentDisposition(a.filename),
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'none'; sandbox",
          'Cache-Control': 'private, max-age=86400',
        },
      });
    }
    return err('not found', 404);
  }

  if (path === '/send' && method === 'POST') {
    const fd = await request.formData();
    const to = parseAddrs(fd.get('to'));
    const cc = parseAddrs(fd.get('cc'));
    const bcc = parseAddrs(fd.get('bcc'));
    const all = [...to, ...cc, ...bcc];
    if (!to.length) return err('请填收件人');
    const bad = all.find((a) => !EMAIL_RE.test(a));
    if (bad) return err(`地址格式不对:${bad}`);
    if (all.length > 50) return err('收件人最多 50 个');
    const subject = String(fd.get('subject') || '').slice(0, 500);
    const text = String(fd.get('text') || '');
    const files = fd.getAll('files').filter((f) => f && typeof f === 'object' && f.size > 0);
    let total = text.length;
    const attachments = [];
    for (const f of files) {
      total += f.size;
      if (total > MAX_SEND_BYTES) return err('附件总大小不能超过 20MB');
      attachments.push({ filename: f.name || 'file', type: f.type || 'application/octet-stream', bytes: new Uint8Array(await f.arrayBuffer()) });
    }

    // 回复时带上原信的 Message-ID,方便对方客户端归到同一会话
    let inReplyTo = null, references = null;
    const replyId = String(fd.get('reply_to_id') || '');
    if (replyId) {
      const orig = await loadMsg(env, user, replyId);
      if (orig?.message_id) {
        inReplyTo = orig.message_id;
        references = [orig.refs, orig.message_id].filter(Boolean).join(' ');
      }
    }

    // 管理员替别的邮箱发信时,发件人是那个邮箱
    let fromAddr = user.address;
    const asBox = String(fd.get('from') || '').toLowerCase();
    if (asBox && asBox !== user.address) {
      if (!user.is_admin || !domainsOf(env).includes(asBox.split('@')[1])) return err('不能用这个地址发信', 403);
      fromAddr = asBox;
    }
    const fromUser = await env.DB.prepare('SELECT name FROM users WHERE address = ?').bind(fromAddr).first();
    const html = textToHtml(text);
    let outId;
    try {
      outId = await sendOut(env, {
        from: { email: fromAddr, name: fromUser?.name || '' },
        to, cc, bcc, subject, text, html, inReplyTo, references, attachments,
      });
    } catch (e) {
      console.error('send failed', e.code, e.message);
      return err(`发送失败:${e.code ? e.code + ' ' : ''}${e.message}`, 502);
    }

    // 存进「已发送」
    const id = crypto.randomUUID();
    const attach = [];
    for (const [i, a] of attachments.entries()) {
      await env.BUCKET.put(`att/${id}/${i}`, a.bytes, { httpMetadata: { contentType: a.type } });
      attach.push({ i, filename: a.filename, type: a.type, size: a.bytes.byteLength, cid: null, inline: false });
    }
    await env.BUCKET.put(`body/${id}.json`, JSON.stringify({ text, html: '' }));
    await env.DB.prepare(
      `INSERT INTO messages (id, mailbox, folder, message_id, in_reply_to, refs, from_addr, from_name, to_json, cc_json,
         subject, snippet, attach_json, has_attach, size, seen, date)
       VALUES (?, ?, 'sent', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
    ).bind(
      id, fromUser ? fromAddr : user.address, outId ? `<${String(outId).replace(/^<|>$/g, '')}>` : null, inReplyTo, references, fromAddr, fromUser?.name || '',
      JSON.stringify(to.map((address) => ({ name: '', address }))),
      JSON.stringify([...cc, ...bcc].map((address) => ({ name: '', address }))),
      subject, snippetOf(text, ''), JSON.stringify(attach), attach.length ? 1 : 0, total, Date.now()
    ).run();
    return json({ ok: true, id });
  }

  if (path === '/password' && method === 'POST') {
    const { old, password } = await request.json().catch(() => ({}));
    const u = await env.DB.prepare('SELECT pass_hash FROM users WHERE id = ?').bind(user.id).first();
    if (!(await verifyPassword(String(old || ''), u.pass_hash))) return err('原密码不对');
    if (String(password || '').length < 10) return err('新密码至少 10 位');
    await env.DB.prepare('UPDATE users SET pass_hash = ?, session_ver = session_ver + 1 WHERE id = ?')
      .bind(await hashPassword(password), user.id).run();
    const fresh = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
    return json({ ok: true }, 200, { 'Set-Cookie': await makeSessionCookie(env, fresh) });
  }

  if (path === '/profile' && method === 'POST') {
    const { name } = await request.json().catch(() => ({}));
    await env.DB.prepare('UPDATE users SET name = ? WHERE id = ?').bind(String(name || '').slice(0, 80), user.id).run();
    return json({ ok: true });
  }

  // ---- 管理员:邮箱账号管理 ----
  if (path.startsWith('/admin/')) {
    if (!user.is_admin) return err('需要管理员', 403);

    if (path === '/admin/users' && method === 'GET') {
      const r = await env.DB.prepare(
        `SELECT u.id, u.address, u.name, u.is_admin, u.created_at,
           (SELECT COUNT(*) FROM messages m WHERE m.mailbox = u.address) AS total
         FROM users u ORDER BY u.address`
      ).all();
      return json({ items: r.results, domains: domainsOf(env), catch_all: env.CATCH_ALL || '' });
    }

    if (path === '/admin/users' && method === 'POST') {
      const b = await request.json().catch(() => ({}));
      const address = String(b.address || '').trim().toLowerCase();
      if (!EMAIL_RE.test(address) || address.includes('+')) return err('地址格式不对');
      if (!domainsOf(env).includes(address.split('@')[1])) return err(`只能用这些域名:${domainsOf(env).join(', ')}`);
      if (String(b.password || '').length < 10) return err('密码至少 10 位');
      try {
        await env.DB.prepare('INSERT INTO users (address, name, pass_hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?)')
          .bind(address, String(b.name || '').slice(0, 80), await hashPassword(b.password), b.is_admin ? 1 : 0, Date.now()).run();
      } catch {
        return err('这个地址已经存在');
      }
      return json({ ok: true });
    }

    const um = path.match(/^\/admin\/users\/(\d+)(\/password)?$/);
    if (um) {
      const target = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(Number(um[1])).first();
      if (!target) return err('没有这个账号', 404);
      if (um[2] && method === 'POST') {
        const { password } = await request.json().catch(() => ({}));
        if (String(password || '').length < 10) return err('密码至少 10 位');
        await env.DB.prepare('UPDATE users SET pass_hash = ?, session_ver = session_ver + 1 WHERE id = ?')
          .bind(await hashPassword(password), target.id).run();
        return json({ ok: true });
      }
      if (!um[2] && method === 'DELETE') {
        if (target.id === user.id) return err('不能删除自己');
        // 只删账号;信件保留,管理员仍可在邮箱列表里看到。之后发到这个地址的信会退回(或进 CATCH_ALL)
        await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(target.id).run();
        return json({ ok: true });
      }
    }
  }

  return err('not found', 404);
}

// 每天清理垃圾箱里放了很久的信
async function cleanupTrash(env) {
  const days = Number(env.TRASH_DAYS) || 30;
  const cutoff = Date.now() - days * 86400000;
  for (;;) {
    const r = await env.DB.prepare(`SELECT id, attach_json FROM messages WHERE folder = 'trash' AND moved_at < ? LIMIT 100`).bind(cutoff).all();
    if (!r.results.length) break;
    for (const m of r.results) {
      await deleteMsgObjects(env, m);
      await env.DB.prepare('DELETE FROM messages WHERE id = ?').bind(m.id).run();
    }
  }
  await env.DB.prepare('DELETE FROM login_fail WHERE until < ?').bind(Date.now()).run();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        const cfgEnv = await withConfig(env);
        Object.defineProperty(cfgEnv, '__raw', { value: env });
        return await api(request, cfgEnv, url);
      } catch (e) {
        console.error(e);
        return err('服务器出错了', 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
  async email(message, env) {
    const cfgEnv = await withConfig(env);
    if (!isConfigured(cfgEnv)) {
      message.setReject('Mailbox not set up yet');
      return;
    }
    await receive(message, cfgEnv);
  },
  async scheduled(event, env) {
    await cleanupTrash(await withConfig(env));
  },
};
