// 临时地址、个人设置、草稿、管理后台(账号、别名群组、收信规则、统计、记录)
import { hashPassword } from './auth.js';
import { saveSetting, getSetting } from './config.js';
import { snippetOf, sendOut } from './mail.js';
import { tgCall, tgLink } from './telegram.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const err = (msg, status = 400) => json({ error: msg }, status);
const body = (request) => request.json().catch(() => ({}));

export const EMAIL_RE = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]+$/;
const LOCAL_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const domainsOf = (env) => (env.DOMAINS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const isLocal = (env, a) => domainsOf(env).includes(String(a).split('@')[1]);
const clean = (s, n = 200) => String(s ?? '').trim().slice(0, n);
const lower = (s) => String(s || '').trim().toLowerCase();
const DAY = 86400000;

// 地址是否已被账号、临时地址、别名或群组占用
async function taken(env, address) {
  const u = await env.DB.prepare('SELECT 1 FROM users WHERE address = ?').bind(address).first();
  const a = await env.DB.prepare('SELECT 1 FROM addresses WHERE address = ?').bind(address).first();
  return !!(u || a);
}

// 外部转发地址：必须是本域名以外的合法邮箱
const FWD_MODES = ['cf', 'send'];
function checkMode(env, v) {
  if (!FWD_MODES.includes(v)) return { error: '转发方式不对' };
  if (v === 'send' && !env.RESEND_API_KEY) return { error: '还没开通 Resend 发信，不能用这种转发方式' };
  return { value: v };
}

function checkFwd(env, v) {
  const a = lower(v);
  if (!a) return { value: '' };
  if (!EMAIL_RE.test(a)) return { error: `转发地址格式不对：${a}` };
  if (isLocal(env, a)) return { error: '转发地址不能是本域名的地址(本域名内请用别名或群组)' };
  return { value: a };
}

function randomLocal() {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  return [...crypto.getRandomValues(new Uint8Array(10))].map((n) => abc[n % abc.length]).join('');
}

// 当前用户可以用来发信的地址：自己、自己的别名、自己启用中的临时地址
export async function fromAddresses(env, user) {
  const r = await env.DB.prepare(
    `SELECT address, kind FROM addresses WHERE owner = ? AND kind IN ('alias', 'temp') AND enabled = 1 AND (expires_at = 0 OR expires_at > ?) ORDER BY kind, address`
  ).bind(user.address, Date.now()).all();
  return [user.address, ...r.results.map((x) => x.address)];
}

const addrRow = (a) => ({ ...a, members: JSON.parse(a.members || '[]') });

// ---------- 品牌(系统名称、Logo):不用登录就能读，登录页也要显示 ----------
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];
export async function brandRoutes(path, method, env, url) {
  if (path === '/brand' && method === 'GET') {
    const name = (await getSetting(env, 'brand_name')) || 'OneMail';
    const ver = await getSetting(env, 'brand_logo_ver');
    return json({ name, logo: ver ? `/api/brand/logo?v=${ver}` : '' });
  }
  if (path === '/brand/logo' && method === 'GET') {
    const obj = await env.BUCKET.get('brand/logo');
    if (!obj) return err('没有 Logo', 404);
    return new Response(obj.body, {
      headers: {
        'Content-Type': obj.httpMetadata?.contentType || 'image/png',
        'Cache-Control': url.searchParams.get('v') ? 'public, max-age=31536000, immutable' : 'no-cache',
        // SVG 也可能带脚本：单独打开时不让它运行
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }
  return null;
}

// 升级前用过的前缀(收过信但没登记的地址)补登记成自动临时地址，只做一次
async function backfillAuto(env) {
  // 以前单独设过去向的临时地址：管理员的改成跟随全局设置，普通账号的改成进自己邮箱
  if (!(await getSetting(env, 'temp_global_v1'))) {
    await env.DB.batch([
      env.DB.prepare(`UPDATE addresses SET auto = 1, deliver = 1, fwd_to = '' WHERE kind = 'temp' AND (owner IS NULL OR owner IN (SELECT address FROM users WHERE is_admin = 1))`),
      env.DB.prepare(`UPDATE addresses SET auto = 0, deliver = 1, fwd_to = '' WHERE kind = 'temp' AND owner IN (SELECT address FROM users WHERE is_admin = 0)`),
    ]);
    await saveSetting(env, 'temp_global_v1', String(Date.now()));
  }
  if (await getSetting(env, 'auto_temp_v1')) return;
  const r = await env.DB.prepare(
    `SELECT envelope_to AS a, mailbox, COUNT(*) AS n, MAX(date) AS last FROM messages
     WHERE envelope_to IS NOT NULL AND folder NOT IN ('sent', 'drafts') GROUP BY envelope_to, mailbox`
  ).all();
  const users = new Set((await env.DB.prepare('SELECT address FROM users').all()).results.map((x) => x.address));
  const known = new Set((await env.DB.prepare('SELECT address FROM addresses').all()).results.map((x) => x.address));
  const merged = new Map();
  for (const x of r.results) {
    const [l, d] = String(x.a).toLowerCase().split('@');
    if (!d || !isLocal(env, x.a)) continue;
    const addr = `${l.split('+')[0]}@${d}`;
    if (users.has(addr) || known.has(addr) || addr === x.mailbox) continue;
    const m = merged.get(addr) || { owner: x.mailbox, n: 0, last: 0 };
    m.n += x.n; m.last = Math.max(m.last, x.last);
    merged.set(addr, m);
  }
  const stmts = [...merged].map(([addr, m]) => env.DB.prepare(
    `INSERT OR IGNORE INTO addresses (address, kind, owner, auto, hits, last_at, created_at) VALUES (?, 'temp', ?, 1, ?, ?, ?)`
  ).bind(addr, m.owner, m.n, m.last, m.last));
  for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
  await saveSetting(env, 'auto_temp_v1', String(Date.now()));
}

export async function extra(path, method, request, env, user, url) {
  // ---------- 个人设置 ----------
  if (path === '/settings' && method === 'GET') {
    const u = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
    const used = (await env.DB.prepare('SELECT COALESCE(SUM(size), 0) AS n FROM messages WHERE mailbox = ?').bind(u.address).first()).n;
    const sent = (await env.DB.prepare(`SELECT COUNT(*) AS n FROM messages WHERE mailbox = ? AND folder = 'sent' AND date > ?`).bind(u.address, Date.now() - DAY).first()).n;
    return json({
      name: u.name, signature: u.signature, fwd_to: u.fwd_to, fwd_keep: !!u.fwd_keep, fwd_mode: u.fwd_mode || 'cf',
      ar_on: !!u.ar_on, ar_subject: u.ar_subject, ar_body: u.ar_body, ar_until: u.ar_until,
      quota_mb: u.quota_mb, used, send_limit: u.send_limit, sent_24h: sent,
      tg_bot: env.TG_TOKEN ? env.TG_BOT : '', tg_bound: !!u.tg_chat, tg_body: !!u.tg_body, tg_bulk: !!u.tg_bulk,
      fwd_status: await fwdStatus(env, u),
    });
  }
  if (path === '/settings' && method === 'POST') {
    const b = await body(request);
    const sets = [], args = [];
    const put = (col, v) => { sets.push(`${col} = ?`); args.push(v); };
    if ('name' in b) put('name', clean(b.name, 80));
    if ('signature' in b) put('signature', clean(b.signature, 2000));
    if ('fwd_to' in b) { const f = checkFwd(env, b.fwd_to); if (f.error) return err(f.error); put('fwd_to', f.value); }
    if ('fwd_keep' in b) put('fwd_keep', b.fwd_keep ? 1 : 0);
    if ('fwd_mode' in b) { const f = checkMode(env, b.fwd_mode); if (f.error) return err(f.error); put('fwd_mode', f.value); }
    if ('ar_on' in b) put('ar_on', b.ar_on ? 1 : 0);
    if ('ar_subject' in b) put('ar_subject', clean(b.ar_subject, 200));
    if ('ar_body' in b) put('ar_body', clean(b.ar_body, 5000));
    if ('ar_until' in b) put('ar_until', Number(b.ar_until) || 0);
    if ('tg_body' in b) put('tg_body', b.tg_body ? 1 : 0);
    if ('tg_bulk' in b) put('tg_bulk', b.tg_bulk ? 1 : 0);
    if (!sets.length) return json({ ok: true });
    await env.DB.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...args, user.id).run();
    return json({ ok: true });
  }

  // 发测试信:从自己的地址发给自己,走完整的收信 → 转发流程
  if (path === '/fwd/test' && method === 'POST') {
    const u = await env.DB.prepare('SELECT address, name, fwd_to FROM users WHERE id = ?').bind(user.id).first();
    if (!u.fwd_to) return err('还没设置转发地址');
    if (!env.RESEND_API_KEY && !env.EMAIL) return err('还没开通发信，没法发测试信');
    const at = Date.now();
    try {
      await sendOut(env, {
        from: { email: u.address, name: u.name || '' }, to: [u.address], cc: [], bcc: [], attachments: [],
        subject: 'OneMail 转发测试', text: `这是一封转发测试信。如果你在 ${u.fwd_to} 收到了它，说明转发设置成功。`,
      });
    } catch (e) { return err(`测试信没发出去：${e.message}`); }
    return json({ ok: true, at });
  }

  // ---------- 临时地址(每个人管自己的；管理员加 ?all=1 看全部) ----------
  if (path === '/temp' && method === 'GET') {
    await backfillAuto(env);
    const all = user.is_admin && url.searchParams.get('all') === '1';
    // 管理员的「我的」也包括没有归属邮箱的自动地址(兜底只转发、不存邮箱时)
    const mine = user.is_admin ? '(owner = ? OR owner IS NULL)' : 'owner = ?';
    const r = await env.DB.prepare(
      `SELECT * FROM addresses WHERE kind = 'temp' ${all ? '' : 'AND ' + mine} ORDER BY MAX(last_at, created_at) DESC`
    ).bind(...(all ? [] : [user.address])).all();
    const out = { items: r.results.map(addrRow), domain: domainsOf(env)[0] || '' };
    // 默认规则就是兜底规则；管理员能看能改
    out.catch_all_on = !!env.CATCH_ALL_ON;
    if (user.is_admin) out.defaults = { box: env.CATCH_ALL || '', fwd: env.CATCH_ALL_FWD || '', locked: !!env.CATCH_ALL_LOCKED };
    return json(out);
  }
  if (path === '/temp' && method === 'POST') {
    const b = await body(request);
    const domain = domainsOf(env)[0];
    if (!domain) return err('还没有设置域名');
    let local = lower(b.local).replace(/@.*$/, '');
    if (!local) local = randomLocal();
    if (!LOCAL_RE.test(local) || local.includes('+')) return err('地址只能用小写字母、数字、点、横线、下划线');
    const address = `${local}@${domain}`;
    if (await taken(env, address)) return err('这个地址已经被占用了，换一个');
    const days = Number(b.days) || 0;
    // 去向不在这里设：管理员的临时地址跟随全局设置(设置 → 临时邮箱收件地址)，普通账号的进自己邮箱
    await env.DB.prepare(
      `INSERT INTO addresses (address, kind, owner, auto, note, expires_at, created_at) VALUES (?, 'temp', ?, ?, ?, ?, ?)`
    ).bind(address, user.address, user.is_admin ? 1 : 0, clean(b.note, 100), days ? Date.now() + days * DAY : 0, Date.now()).run();
    return json({ ok: true, address });
  }
  let m = path.match(/^\/temp\/([^/]+)$/);
  if (m) {
    const address = lower(decodeURIComponent(m[1]));
    const a = await env.DB.prepare(`SELECT * FROM addresses WHERE address = ? AND kind = 'temp'`).bind(address).first();
    if (!a || (a.owner !== user.address && !user.is_admin)) return err('没有这个临时地址', 404);
    if (method === 'DELETE') {
      await env.DB.prepare('DELETE FROM addresses WHERE address = ?').bind(address).run();
      return json({ ok: true });
    }
    if (method === 'PATCH') {
      const b = await body(request);
      const next = { ...a };
      if ('enabled' in b) next.enabled = b.enabled ? 1 : 0;
      if ('note' in b) next.note = clean(b.note, 100);
      if ('days' in b) { const d = Number(b.days) || 0; next.expires_at = d ? Date.now() + d * DAY : 0; }
      await env.DB.prepare('UPDATE addresses SET enabled = ?, note = ?, expires_at = ? WHERE address = ?')
        .bind(next.enabled, next.note, next.expires_at, address).run();
      return json({ ok: true });
    }
  }

  // ---------- 草稿 ----------
  if (path === '/drafts' && method === 'POST') {
    const fd = await request.formData();
    const id = String(fd.get('draft_id') || '') || crypto.randomUUID();
    if (fd.get('draft_id')) {
      const d = await env.DB.prepare(`SELECT mailbox FROM messages WHERE id = ? AND folder = 'drafts'`).bind(id).first();
      if (!d || d.mailbox !== user.address) return err('没有这个草稿', 404);
    }
    const list = (k) => String(fd.get(k) || '').split(/[,;，；\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean).map((address) => ({ name: '', address }));
    const text = String(fd.get('text') || '');
    const subject = String(fd.get('subject') || '').slice(0, 500);
    const meta = { from: lower(fd.get('from')) || user.address, bcc: list('bcc'), reply_to_id: String(fd.get('reply_to_id') || '') };
    await env.BUCKET.put(`body/${id}.json`, JSON.stringify({ text, html: '', draft: meta }));
    await env.DB.prepare(
      `INSERT INTO messages (id, mailbox, folder, from_addr, from_name, to_json, cc_json, subject, snippet, size, seen, date)
       VALUES (?, ?, 'drafts', ?, '', ?, ?, ?, ?, ?, 1, ?)
       ON CONFLICT(id) DO UPDATE SET to_json = excluded.to_json, cc_json = excluded.cc_json, subject = excluded.subject,
         snippet = excluded.snippet, size = excluded.size, date = excluded.date, from_addr = excluded.from_addr`
    ).bind(id, user.address, meta.from, JSON.stringify(list('to')), JSON.stringify(list('cc')), subject, snippetOf(text, ''), text.length, Date.now()).run();
    return json({ ok: true, id });
  }

  // ---------- Telegram 通知(每个人自己绑定) ----------
  if (path === '/tg/link' && method === 'POST') {
    if (!env.TG_TOKEN || !env.TG_BOT) return err('管理员还没设置 Telegram 机器人');
    return json({ url: await tgLink(env, user.id) });
  }
  if (path === '/tg/unbind' && method === 'POST') {
    await env.DB.prepare("UPDATE users SET tg_chat = '' WHERE id = ?").bind(user.id).run();
    return json({ ok: true });
  }
  if (path === '/tg/test' && method === 'POST') {
    const u = await env.DB.prepare('SELECT tg_chat FROM users WHERE id = ?').bind(user.id).first();
    if (!env.TG_TOKEN || !u?.tg_chat) return err('还没绑定 Telegram');
    const j = await tgCall(env.TG_TOKEN, 'sendMessage', { chat_id: u.tg_chat, text: `测试消息：${user.address} 的新邮件会推送到这里。` });
    if (!j.ok) return err(`发送失败：${j.description || ''}`);
    return json({ ok: true });
  }

  if (!path.startsWith('/admin/')) return null;
  if (!user.is_admin) return err('需要管理员', 403);

  // ---------- 概览 ----------
  if (path === '/admin/overview' && method === 'GET') {
    const now = Date.now();
    const one = async (sql, ...a) => (await env.DB.prepare(sql).bind(...a).first()).n;
    const top = await env.DB.prepare(
      `SELECT envelope_to AS address, COUNT(*) AS n FROM messages WHERE folder != 'sent' AND envelope_to IS NOT NULL AND date > ? GROUP BY envelope_to ORDER BY n DESC LIMIT 8`
    ).bind(now - 30 * DAY).all();
    const days = await env.DB.prepare(
      `SELECT CAST((? - date) / ${DAY} AS INTEGER) AS d, SUM(CASE WHEN folder = 'sent' THEN 1 ELSE 0 END) AS sent,
         SUM(CASE WHEN folder NOT IN ('sent', 'drafts') THEN 1 ELSE 0 END) AS recv
       FROM messages WHERE date > ? GROUP BY d`
    ).bind(now, now - 14 * DAY).all();
    return json({
      users: await one('SELECT COUNT(*) AS n FROM users'),
      disabled: await one('SELECT COUNT(*) AS n FROM users WHERE disabled = 1'),
      temps: await one(`SELECT COUNT(*) AS n FROM addresses WHERE kind = 'temp' AND enabled = 1`),
      aliases: await one(`SELECT COUNT(*) AS n FROM addresses WHERE kind IN ('alias', 'group')`),
      messages: await one(`SELECT COUNT(*) AS n FROM messages WHERE folder != 'drafts'`),
      storage: await one('SELECT COALESCE(SUM(size), 0) AS n FROM messages'),
      recv_24h: await one(`SELECT COUNT(*) AS n FROM messages WHERE folder NOT IN ('sent', 'drafts') AND date > ?`, now - DAY),
      sent_24h: await one(`SELECT COUNT(*) AS n FROM messages WHERE folder = 'sent' AND date > ?`, now - DAY),
      rejects_7d: await one(`SELECT COUNT(*) AS n FROM logs WHERE kind = 'reject' AND at > ?`, now - 7 * DAY),
      fwd_fail_7d: await one(`SELECT COUNT(*) AS n FROM logs WHERE kind = 'forward_fail' AND at > ?`, now - 7 * DAY),
      top: top.results,
      days: days.results,
      can_send: !!(env.RESEND_API_KEY || env.EMAIL),
    });
  }

  // ---------- 账号 ----------
  if (path === '/admin/users' && method === 'GET') {
    const r = await env.DB.prepare(
      `SELECT u.id, u.address, u.name, u.is_admin, u.disabled, u.quota_mb, u.send_limit, u.fwd_to, u.fwd_mode, u.ar_on, u.last_login, u.created_at,
         (SELECT COUNT(*) FROM messages m WHERE m.mailbox = u.address) AS total,
         (SELECT COALESCE(SUM(size), 0) FROM messages m WHERE m.mailbox = u.address) AS used,
         (SELECT group_concat(a.address, ', ') FROM addresses a WHERE a.owner = u.address AND a.kind = 'alias') AS aliases
       FROM users u ORDER BY u.is_admin DESC, u.address`
    ).all();
    return json({ items: r.results, domains: domainsOf(env), catch_all: env.CATCH_ALL || '' });
  }
  if (path === '/admin/users' && method === 'POST') {
    const b = await body(request);
    const address = lower(b.address);
    if (!EMAIL_RE.test(address) || address.includes('+')) return err('地址格式不对');
    if (!isLocal(env, address)) return err(`只能用这些域名：${domainsOf(env).join(', ')}`);
    if (String(b.password || '').length < 10) return err('密码至少 10 位');
    if (await taken(env, address)) return err('这个地址已经存在(账号、别名或临时地址)');
    const f = checkFwd(env, b.fwd_to); if (f.error) return err(f.error);
    const fm = b.fwd_mode ? checkMode(env, b.fwd_mode) : { value: 'cf' }; if (fm.error) return err(fm.error);
    await env.DB.prepare('INSERT INTO users (address, name, pass_hash, is_admin, quota_mb, send_limit, fwd_to, fwd_keep, fwd_mode, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(address, clean(b.name, 80), await hashPassword(b.password), b.is_admin ? 1 : 0, Math.max(0, Number(b.quota_mb) || 0), Math.max(0, Number(b.send_limit) || 0),
        f.value, b.fwd_keep === false ? 0 : 1, fm.value, Date.now()).run();
    return json({ ok: true });
  }
  m = path.match(/^\/admin\/users\/(\d+)(\/password|\/logout)?$/);
  if (m) {
    const target = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(Number(m[1])).first();
    if (!target) return err('没有这个账号', 404);
    const self = target.id === user.id;
    if (m[2] === '/password' && method === 'POST') {
      const { password } = await body(request);
      if (String(password || '').length < 10) return err('密码至少 10 位');
      await env.DB.prepare('UPDATE users SET pass_hash = ?, session_ver = session_ver + 1 WHERE id = ?').bind(await hashPassword(password), target.id).run();
      return json({ ok: true });
    }
    if (m[2] === '/logout' && method === 'POST') {
      await env.DB.prepare('UPDATE users SET session_ver = session_ver + 1 WHERE id = ?').bind(target.id).run();
      return json({ ok: true });
    }
    if (!m[2] && method === 'PATCH') {
      const b = await body(request);
      if (self && ('disabled' in b && b.disabled)) return err('不能停用自己');
      if (self && ('is_admin' in b && !b.is_admin)) return err('不能取消自己的管理员');
      const sets = [], args = [];
      const put = (col, v) => { sets.push(`${col} = ?`); args.push(v); };
      if ('name' in b) put('name', clean(b.name, 80));
      if ('is_admin' in b) put('is_admin', b.is_admin ? 1 : 0);
      if ('quota_mb' in b) put('quota_mb', Math.max(0, Number(b.quota_mb) || 0));
      if ('send_limit' in b) put('send_limit', Math.max(0, Number(b.send_limit) || 0));
      if ('fwd_to' in b) { const f = checkFwd(env, b.fwd_to); if (f.error) return err(f.error); put('fwd_to', f.value); }
      if ('fwd_mode' in b) { const f = checkMode(env, b.fwd_mode); if (f.error) return err(f.error); put('fwd_mode', f.value); }
      if ('disabled' in b) { put('disabled', b.disabled ? 1 : 0); if (b.disabled) sets.push('session_ver = session_ver + 1'); }
      if (sets.length) await env.DB.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...args, target.id).run();
      return json({ ok: true });
    }
    if (!m[2] && method === 'DELETE') {
      if (self) return err('不能删除自己');
      // 只删账号和它的别名、临时地址；信件保留，管理员仍可在邮箱列表里查看
      await env.DB.batch([
        env.DB.prepare('DELETE FROM users WHERE id = ?').bind(target.id),
        env.DB.prepare(`DELETE FROM addresses WHERE owner = ? AND kind IN ('alias', 'temp')`).bind(target.address),
      ]);
      return json({ ok: true });
    }
  }

  // ---------- 别名、群组 ----------
  if (path === '/admin/addresses' && method === 'GET') {
    const kind = url.searchParams.get('kind');
    const r = await env.DB.prepare(
      `SELECT * FROM addresses WHERE kind ${kind ? '= ?' : `IN ('alias', 'group')`} ORDER BY kind, address`
    ).bind(...(kind ? [kind] : [])).all();
    return json({ items: r.results.map(addrRow) });
  }
  if (path === '/admin/addresses' && method === 'POST') {
    const b = await body(request);
    const kind = b.kind === 'group' ? 'group' : 'alias';
    const domain = domainsOf(env)[0];
    const local = lower(b.local).replace(/@.*$/, '');
    if (!LOCAL_RE.test(local)) return err('地址只能用小写字母、数字、点、横线、下划线');
    const address = `${local}@${domain}`;
    if (await taken(env, address)) return err('这个地址已经被占用了');
    let owner = null, members = [];
    if (kind === 'alias') {
      owner = lower(b.owner);
      if (!(await env.DB.prepare('SELECT 1 FROM users WHERE address = ?').bind(owner).first())) return err('请选择这个别名属于哪个账号');
    } else {
      members = [...new Set((Array.isArray(b.members) ? b.members : String(b.members || '').split(/[,;，；\s]+/)).map(lower).filter(Boolean))];
      if (!members.length) return err('群组至少要有一个成员');
      const bad = members.find((x) => !EMAIL_RE.test(x));
      if (bad) return err(`成员地址格式不对：${bad}`);
      if (members.length > 50) return err('群组最多 50 个成员');
    }
    await env.DB.prepare(`INSERT INTO addresses (address, kind, owner, members, note, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(address, kind, owner, JSON.stringify(members), clean(b.note, 100), Date.now()).run();
    return json({ ok: true, address });
  }
  m = path.match(/^\/admin\/addresses\/([^/]+)$/);
  if (m) {
    const address = lower(decodeURIComponent(m[1]));
    const a = await env.DB.prepare('SELECT * FROM addresses WHERE address = ?').bind(address).first();
    if (!a) return err('没有这个地址', 404);
    if (method === 'DELETE') {
      await env.DB.prepare('DELETE FROM addresses WHERE address = ?').bind(address).run();
      return json({ ok: true });
    }
    if (method === 'PATCH') {
      const b = await body(request);
      const next = { ...a };
      if ('enabled' in b) next.enabled = b.enabled ? 1 : 0;
      if ('note' in b) next.note = clean(b.note, 100);
      if ('owner' in b && a.kind !== 'group') {
        next.owner = lower(b.owner);
        if (!(await env.DB.prepare('SELECT 1 FROM users WHERE address = ?').bind(next.owner).first())) return err('没有这个账号');
      }
      if ('members' in b && a.kind === 'group') {
        const list = [...new Set((Array.isArray(b.members) ? b.members : String(b.members || '').split(/[,;，；\s]+/)).map(lower).filter(Boolean))];
        if (!list.length) return err('群组至少要有一个成员');
        const bad = list.find((x) => !EMAIL_RE.test(x));
        if (bad) return err(`成员地址格式不对：${bad}`);
        next.members = JSON.stringify(list);
      }
      await env.DB.prepare('UPDATE addresses SET enabled = ?, note = ?, owner = ?, members = ? WHERE address = ?')
        .bind(next.enabled, next.note, next.owner, next.members, address).run();
      return json({ ok: true });
    }
  }

  // ---------- Telegram 机器人 ----------
  if (path === '/admin/telegram' && method === 'GET') {
    const n = (await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE tg_chat != ''").first()).n;
    return json({ bot: env.TG_TOKEN ? env.TG_BOT : '', bound: n, https: url.protocol === 'https:' });
  }
  if (path === '/admin/telegram' && method === 'POST') {
    const b = await body(request);
    const token = clean(b.token, 120);
    if (!token) {
      if (env.TG_TOKEN) await tgCall(env.TG_TOKEN, 'deleteWebhook', {});
      for (const k of ['tg_token', 'tg_bot', 'tg_secret']) await saveSetting(env, k, null);
      await env.DB.prepare("UPDATE users SET tg_chat = ''").run();
      return json({ ok: true, note: '已断开机器人' });
    }
    if (!/^\d{5,}:[A-Za-z0-9_-]{30,}$/.test(token)) return err('Token 格式不对，应该像 123456789:AAH... 这样');
    const me = await tgCall(token, 'getMe');
    if (!me.ok) return err(`Telegram 不认这个 Token:${me.description || ''}`);
    const secret = [...crypto.getRandomValues(new Uint8Array(24))].map((x) => x.toString(16).padStart(2, '0')).join('');
    let note = `已连接 @${me.result.username}`;
    if (url.protocol === 'https:') {
      const w = await tgCall(token, 'setWebhook', { url: `${url.origin}/tg/webhook`, secret_token: secret, allowed_updates: ['message'], drop_pending_updates: true });
      if (!w.ok) return err(`设置机器人回调失败：${w.description || ''}`);
    } else note += '。当前不是 https 地址，Telegram 回调不到这里，绑定要在线上使用';
    await saveSetting(env, 'tg_token', token);
    await saveSetting(env, 'tg_bot', me.result.username);
    await saveSetting(env, 'tg_secret', secret);
    await saveSetting(env, 'app_url', url.origin);
    return json({ ok: true, note, bot: me.result.username });
  }

  // ---------- 收信规则：发到不存在地址的信 ----------
  if (path === '/admin/routing' && method === 'GET') {
    return json({ catch_all_on: !!env.CATCH_ALL_ON, catch_all: env.CATCH_ALL || '', catch_all_fwd: env.CATCH_ALL_FWD || '', catch_all_fwd_mode: env.CATCH_ALL_FWD_MODE || 'cf', locked: !!env.CATCH_ALL_LOCKED, domain: domainsOf(env)[0] || '' });
  }
  if (path === '/admin/routing' && method === 'POST') {
    const b = await body(request);
    if ('catch_all_on' in b) await saveSetting(env, 'catch_all_off', b.catch_all_on ? null : '1');
    if ('catch_all' in b) {
      if (env.CATCH_ALL_LOCKED) return err('兜底邮箱写在配置文件里（CATCH_ALL），这里改不了');
      const box = lower(b.catch_all);
      if (box && !(await env.DB.prepare('SELECT 1 FROM users WHERE address = ?').bind(box).first())) return err('兜底邮箱必须是已有的账号');
      await saveSetting(env, 'catch_all', box || null);
    }
    if ('catch_all_fwd' in b) {
      const f = checkFwd(env, b.catch_all_fwd); if (f.error) return err(f.error);
      await saveSetting(env, 'catch_all_fwd', f.value);
    }
    if ('catch_all_fwd_mode' in b) {
      const f = checkMode(env, b.catch_all_fwd_mode); if (f.error) return err(f.error);
      await saveSetting(env, 'catch_all_fwd_mode', f.value === 'cf' ? null : f.value);
    }
    return json({ ok: true });
  }

  // ---------- 品牌 ----------
  if (path === '/admin/brand' && method === 'POST') {
    const b = await body(request);
    const name = clean(b.name, 40);
    await saveSetting(env, 'brand_name', name || null);
    return json({ ok: true });
  }
  if (path === '/admin/brand/logo' && method === 'POST') {
    const fd = await request.formData();
    const f = fd.get('logo');
    if (!f || typeof f === 'string' || !f.size) return err('请选择图片');
    if (!LOGO_TYPES.includes(f.type)) return err('只支持 PNG、JPG、WebP、GIF、SVG 图片');
    if (f.size > 512 * 1024) return err('图片不能超过 512KB');
    await env.BUCKET.put('brand/logo', await f.arrayBuffer(), { httpMetadata: { contentType: f.type } });
    await saveSetting(env, 'brand_logo_ver', String(Date.now()));
    return json({ ok: true });
  }
  if (path === '/admin/brand/logo' && method === 'DELETE') {
    await env.BUCKET.delete('brand/logo');
    await saveSetting(env, 'brand_logo_ver', null);
    return json({ ok: true });
  }

  // ---------- 记录 ----------
  if (path === '/admin/logs' && method === 'GET') {
    const kinds = {
      login: ['login', 'login_fail'],
      mail: ['deliver', 'reject', 'forward', 'forward_fail', 'quota', 'autoreply', 'autoreply_fail', 'tg_fail'],
      send: ['send', 'send_fail'],
    }[url.searchParams.get('type')] || ['login', 'login_fail'];
    const q = lower(url.searchParams.get('q'));
    const r = await env.DB.prepare(
      `SELECT * FROM logs WHERE kind IN (${kinds.map(() => '?').join(',')}) ${q ? `AND (actor LIKE ?${kinds.length + 1} OR target LIKE ?${kinds.length + 1})` : ''} ORDER BY at DESC LIMIT 200`
    ).bind(...kinds, ...(q ? [`%${q}%`] : [])).all();
    return json({ items: r.results });
  }

  return null;
}

// 最近一次转发到这个外部地址的结果
async function fwdStatus(env, u) {
  if (!u.fwd_to) return null;
  const r = await env.DB.prepare(
    "SELECT kind, at, detail FROM logs WHERE kind IN ('forward', 'forward_fail') AND detail LIKE ? ORDER BY at DESC LIMIT 1"
  ).bind(`%${u.fwd_to}%`).first();
  return r ? { ok: r.kind === 'forward', at: r.at, detail: r.detail } : null;
}
