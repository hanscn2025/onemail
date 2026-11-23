// 临时地址、个人设置、草稿、管理后台(账号、别名群组、收信规则、统计、记录)
import { hashPassword } from './auth.js';
import { saveSetting } from './config.js';
import { snippetOf } from './mail.js';

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

// 外部转发地址:必须是本域名以外的合法邮箱
function checkFwd(env, v) {
  const a = lower(v);
  if (!a) return { value: '' };
  if (!EMAIL_RE.test(a)) return { error: `转发地址格式不对:${a}` };
  if (isLocal(env, a)) return { error: '转发地址不能是本域名的地址(本域名内请用别名或群组)' };
  return { value: a };
}

function randomLocal() {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  return [...crypto.getRandomValues(new Uint8Array(10))].map((n) => abc[n % abc.length]).join('');
}

// 当前用户可以用来发信的地址:自己、自己的别名、自己启用中的临时地址
export async function fromAddresses(env, user) {
  const r = await env.DB.prepare(
    `SELECT address, kind FROM addresses WHERE owner = ? AND kind IN ('alias', 'temp') AND enabled = 1 AND (expires_at = 0 OR expires_at > ?) ORDER BY kind, address`
  ).bind(user.address, Date.now()).all();
  return [user.address, ...r.results.map((x) => x.address)];
}

const addrRow = (a) => ({ ...a, members: JSON.parse(a.members || '[]') });

export async function extra(path, method, request, env, user, url) {
  // ---------- 个人设置 ----------
  if (path === '/settings' && method === 'GET') {
    const u = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
    const used = (await env.DB.prepare('SELECT COALESCE(SUM(size), 0) AS n FROM messages WHERE mailbox = ?').bind(u.address).first()).n;
    const sent = (await env.DB.prepare(`SELECT COUNT(*) AS n FROM messages WHERE mailbox = ? AND folder = 'sent' AND date > ?`).bind(u.address, Date.now() - DAY).first()).n;
    return json({
      name: u.name, signature: u.signature, fwd_to: u.fwd_to, fwd_keep: !!u.fwd_keep,
      ar_on: !!u.ar_on, ar_subject: u.ar_subject, ar_body: u.ar_body, ar_until: u.ar_until,
      quota_mb: u.quota_mb, used, send_limit: u.send_limit, sent_24h: sent,
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
    if ('ar_on' in b) put('ar_on', b.ar_on ? 1 : 0);
    if ('ar_subject' in b) put('ar_subject', clean(b.ar_subject, 200));
    if ('ar_body' in b) put('ar_body', clean(b.ar_body, 5000));
    if ('ar_until' in b) put('ar_until', Number(b.ar_until) || 0);
    if (!sets.length) return json({ ok: true });
    await env.DB.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...args, user.id).run();
    return json({ ok: true });
  }

  // ---------- 临时地址(每个人管自己的;管理员加 ?all=1 看全部) ----------
  if (path === '/temp' && method === 'GET') {
    const all = user.is_admin && url.searchParams.get('all') === '1';
    const r = await env.DB.prepare(
      `SELECT * FROM addresses WHERE kind = 'temp' ${all ? '' : 'AND owner = ?'} ORDER BY created_at DESC`
    ).bind(...(all ? [] : [user.address])).all();
    return json({ items: r.results.map(addrRow), domain: domainsOf(env)[0] || '' });
  }
  if (path === '/temp' && method === 'POST') {
    const b = await body(request);
    const domain = domainsOf(env)[0];
    if (!domain) return err('还没有设置域名');
    let local = lower(b.local).replace(/@.*$/, '');
    if (!local) local = randomLocal();
    if (!LOCAL_RE.test(local) || local.includes('+')) return err('地址只能用小写字母、数字、点、横线、下划线');
    const address = `${local}@${domain}`;
    if (await taken(env, address)) return err('这个地址已经被占用了,换一个');
    const f = checkFwd(env, b.fwd_to); if (f.error) return err(f.error);
    const deliver = b.deliver === undefined ? 1 : b.deliver ? 1 : 0;
    if (!deliver && !f.value) return err('至少选一个:存进我的邮箱,或转发到外部邮箱');
    const days = Number(b.days) || 0;
    await env.DB.prepare(
      `INSERT INTO addresses (address, kind, owner, deliver, fwd_to, note, expires_at, created_at) VALUES (?, 'temp', ?, ?, ?, ?, ?, ?)`
    ).bind(address, user.address, deliver, f.value, clean(b.note, 100), days ? Date.now() + days * DAY : 0, Date.now()).run();
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
      if ('deliver' in b) next.deliver = b.deliver ? 1 : 0;
      if ('fwd_to' in b) { const f = checkFwd(env, b.fwd_to); if (f.error) return err(f.error); next.fwd_to = f.value; }
      if ('days' in b) { const d = Number(b.days) || 0; next.expires_at = d ? Date.now() + d * DAY : 0; }
      if (!next.deliver && !next.fwd_to) return err('至少选一个:存进我的邮箱,或转发到外部邮箱');
      await env.DB.prepare('UPDATE addresses SET enabled = ?, note = ?, deliver = ?, fwd_to = ?, expires_at = ? WHERE address = ?')
        .bind(next.enabled, next.note, next.deliver, next.fwd_to, next.expires_at, address).run();
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
      `SELECT u.id, u.address, u.name, u.is_admin, u.disabled, u.quota_mb, u.send_limit, u.fwd_to, u.ar_on, u.last_login, u.created_at,
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
    if (!isLocal(env, address)) return err(`只能用这些域名:${domainsOf(env).join(', ')}`);
    if (String(b.password || '').length < 10) return err('密码至少 10 位');
    if (await taken(env, address)) return err('这个地址已经存在(账号、别名或临时地址)');
    await env.DB.prepare('INSERT INTO users (address, name, pass_hash, is_admin, quota_mb, send_limit, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(address, clean(b.name, 80), await hashPassword(b.password), b.is_admin ? 1 : 0, Math.max(0, Number(b.quota_mb) || 0), Math.max(0, Number(b.send_limit) || 0), Date.now()).run();
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
      if ('disabled' in b) { put('disabled', b.disabled ? 1 : 0); if (b.disabled) sets.push('session_ver = session_ver + 1'); }
      if (sets.length) await env.DB.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...args, target.id).run();
      return json({ ok: true });
    }
    if (!m[2] && method === 'DELETE') {
      if (self) return err('不能删除自己');
      // 只删账号和它的别名、临时地址;信件保留,管理员仍可在邮箱列表里查看
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
      if (bad) return err(`成员地址格式不对:${bad}`);
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
        if (bad) return err(`成员地址格式不对:${bad}`);
        next.members = JSON.stringify(list);
      }
      await env.DB.prepare('UPDATE addresses SET enabled = ?, note = ?, owner = ?, members = ? WHERE address = ?')
        .bind(next.enabled, next.note, next.owner, next.members, address).run();
      return json({ ok: true });
    }
  }

  // ---------- 收信规则:发到不存在地址的信 ----------
  if (path === '/admin/routing' && method === 'GET') {
    return json({ catch_all: env.CATCH_ALL || '', catch_all_fwd: env.CATCH_ALL_FWD || '', locked: !!env.CATCH_ALL_LOCKED, domain: domainsOf(env)[0] || '' });
  }
  if (path === '/admin/routing' && method === 'POST') {
    const b = await body(request);
    if ('catch_all' in b) {
      if (env.CATCH_ALL_LOCKED) return err('兜底邮箱写在配置文件里(CATCH_ALL),这里改不了');
      const box = lower(b.catch_all);
      if (box && !(await env.DB.prepare('SELECT 1 FROM users WHERE address = ?').bind(box).first())) return err('兜底邮箱必须是已有的账号');
      await saveSetting(env, 'catch_all', box || null);
    }
    if ('catch_all_fwd' in b) {
      const f = checkFwd(env, b.catch_all_fwd); if (f.error) return err(f.error);
      await saveSetting(env, 'catch_all_fwd', f.value);
    }
    return json({ ok: true });
  }

  // ---------- 记录 ----------
  if (path === '/admin/logs' && method === 'GET') {
    const kinds = {
      login: ['login', 'login_fail'],
      mail: ['deliver', 'reject', 'forward', 'forward_fail', 'quota', 'autoreply', 'autoreply_fail'],
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
