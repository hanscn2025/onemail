// 收信入库、发信
import PostalMime from 'postal-mime';
import { tgNotify, isBulk } from './telegram.js';

const addrList = (v) => (v || []).flatMap((a) => (a.group ? addrList(a.group) : [{ name: a.name || '', address: (a.address || '').toLowerCase() }]));

export function snippetOf(text, html) {
  let s = text || '';
  if (!s && html) s = html.replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
  return s.replace(/\s+/g, ' ').trim().slice(0, 200);
}

function localPart(addr) {
  const [l, d] = addr.toLowerCase().split('@');
  return `${l.split('+')[0]}@${d}`;
}

export async function addLog(env, kind, actor, target, detail = '', ip = '') {
  try {
    await env.DB.prepare('INSERT INTO logs (at, kind, actor, target, detail, ip) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(Date.now(), kind, String(actor || '').slice(0, 200), String(target || '').slice(0, 200), String(detail || '').slice(0, 500), ip).run();
  } catch (e) { console.error('log failed', e.message); }
}

const domainsOf = (env) => (env.DOMAINS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const isLocal = (env, a) => domainsOf(env).includes(String(a).split('@')[1]);

// 决定一封信去哪：存进哪些邮箱、转发到哪些外部地址
// 返回 { boxes: Set, forwards: Map（外部地址 → 'cf'|'send'）, reject: string|null, via: 'user'|'temp'|'alias'|'group'|'catchall' }
export async function route(env, rcpt) {
  const out = { boxes: new Set(), forwards: new Map(), reject: null, via: '' };
  const user = await env.DB.prepare('SELECT address, disabled FROM users WHERE address = ?').bind(rcpt).first();
  if (user) {
    if (user.disabled) out.reject = 'Mailbox disabled';
    else out.boxes.add(user.address);
    out.via = 'user';
    return out;
  }
  const a = await env.DB.prepare('SELECT * FROM addresses WHERE address = ?').bind(rcpt).first();
  if (a) {
    out.via = a.kind;
    if (!a.enabled || (a.expires_at && a.expires_at < Date.now())) { out.reject = 'Address not found'; return out; }
    if (a.kind === 'temp' && a.auto) {
      // 自动登记的地址：按当前的默认规则送
      catchAll(env, out);
      await env.DB.prepare('UPDATE addresses SET hits = hits + 1, last_at = ? WHERE address = ?').bind(Date.now(), rcpt).run();
      return out;
    }
    if (a.kind === 'group') {
      for (const m of JSON.parse(a.members || '[]')) isLocal(env, m) ? out.boxes.add(m) : out.forwards.set(m, 'cf');
    } else if (a.owner) out.boxes.add(a.owner);
    await env.DB.prepare('UPDATE addresses SET hits = hits + 1, last_at = ? WHERE address = ?').bind(Date.now(), rcpt).run();
    if (!out.boxes.size && !out.forwards.size) out.reject = 'Address not found';
    return out;
  }
  out.via = 'catchall';
  // 关了「任意前缀收信」:没新建过的地址一律退回
  if (!env.CATCH_ALL_ON) { out.reject = 'Address not found'; return out; }
  catchAll(env, out);
  if (!out.reject) {
    // 第一次收到信的前缀自动登记成临时地址，之后可以在临时邮箱里单独停用或改设置
    const box = (env.CATCH_ALL || '').trim().toLowerCase() || null;
    await env.DB.prepare(
      `INSERT OR IGNORE INTO addresses (address, kind, owner, auto, hits, last_at, created_at) VALUES (?, 'temp', ?, 1, 1, ?, ?)`
    ).bind(rcpt, box, Date.now(), Date.now()).run();
  }
  return out;
}

function catchAll(env, out) {
  const box = (env.CATCH_ALL || '').trim().toLowerCase();
  if (box) out.boxes.add(box);
  if (!out.boxes.size && !out.forwards.size) out.reject = 'Address not found';
}

// 自动回复：同一个发件人 4 天内只回一次；群发、退信、自动邮件不回
async function autoReply(env, u, p, sender, rcpt) {
  if (!u.ar_on || (u.ar_until && u.ar_until < Date.now())) return;
  if (!env.RESEND_API_KEY && !env.EMAIL) return;
  const s = String(sender || '').toLowerCase();
  if (!s || s === u.address || /^(no-?reply|mailer-daemon|postmaster|bounce)/i.test(s) || isLocal(env, s) && s === rcpt) return;
  const h = Object.fromEntries((p.headers || []).map((x) => [x.key, String(x.value || '').toLowerCase()]));
  if ((h['auto-submitted'] && h['auto-submitted'] !== 'no') || h['list-id'] || h['list-unsubscribe'] || /bulk|list|junk/.test(h['precedence'] || '')) return;
  const key = `${u.address}|${s}`;
  const seen = await env.DB.prepare('SELECT at FROM autoreply_seen WHERE key = ?').bind(key).first();
  if (seen && seen.at > Date.now() - 4 * 86400000) return;
  await env.DB.prepare('INSERT INTO autoreply_seen (key, at) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET at = excluded.at').bind(key, Date.now()).run();
  const text = u.ar_body || '你好，我暂时不在，回来后会尽快回复你。';
  try {
    await sendOut(env, {
      from: { email: u.address, name: u.name || '' }, to: [s], cc: [], bcc: [],
      subject: u.ar_subject || `自动回复：${p.subject || ''}`, text, html: textToHtml(text),
      inReplyTo: p.messageId || null, references: p.messageId || null, attachments: [], autoReply: true,
    });
    await addLog(env, 'autoreply', u.address, s);
  } catch (e) {
    await addLog(env, 'autoreply_fail', u.address, s, e.message);
  }
}

// 用发信服务把收到的信重新发给外部邮箱：主题、正文、附件不变，回复地址是原发件人
async function forwardViaSend(env, p, message, rcpt, to) {
  const from = p.from?.address ? p.from : { address: message.from, name: '' };
  try {
    await sendOut(env, {
      from: { email: rcpt, name: (from.name || from.address || '').slice(0, 80) },
      to: [to], cc: [], bcc: [],
      replyTo: from.address || undefined,
      subject: p.subject || '(无主题)',
      text: p.text || '', html: p.html || (p.text ? textToHtml(p.text) : ''),
      attachments: (p.attachments || []).map((a) => ({
        filename: a.filename || 'attachment',
        type: a.mimeType || 'application/octet-stream',
        bytes: typeof a.content === 'string' ? new TextEncoder().encode(a.content) : new Uint8Array(a.content),
        cid: a.contentId ? a.contentId.replace(/^<|>$/g, '') : undefined,
      })),
      headers: { 'X-Forwarded-For': rcpt, 'X-Original-From': from.address || '' },
    });
    await addLog(env, 'forward', message.from, rcpt, `通过发信服务转发到 ${to}`);
  } catch (e) {
    await addLog(env, 'forward_fail', message.from, rcpt, `通过发信服务转发到 ${to} 失败：${e.message}`);
  }
}

// 把解析好的信存进一个邮箱。opts 给 IMAP 网关 APPEND 用：放进哪个文件夹、已读/星标、时间
export async function store(env, mailbox, p, raw, message, opts = {}) {
  const id = crypto.randomUUID();
  const attach = [];
  for (const [i, a] of (p.attachments || []).entries()) {
    const content = typeof a.content === 'string' ? new TextEncoder().encode(a.content) : a.content;
    await env.BUCKET.put(`att/${id}/${i}`, content, { httpMetadata: { contentType: a.mimeType || 'application/octet-stream' } });
    attach.push({
      i,
      filename: a.filename || `attachment-${i + 1}`,
      type: a.mimeType || 'application/octet-stream',
      size: content.byteLength,
      cid: a.contentId ? a.contentId.replace(/^<|>$/g, '') : null,
      inline: a.disposition === 'inline',
    });
  }
  await env.BUCKET.put(`raw/${id}.eml`, raw, { httpMetadata: { contentType: 'message/rfc822' } });
  await env.BUCKET.put(`body/${id}.json`, JSON.stringify({ text: p.text || '', html: p.html || '' }), {
    httpMetadata: { contentType: 'application/json' },
  });
  const from = p.from?.address ? p.from : { address: message.from, name: '' };
  const visibleAttach = attach.filter((a) => !(a.inline && a.cid));
  await env.DB.prepare(
    `INSERT INTO messages (id, mailbox, folder, message_id, in_reply_to, refs, envelope_to, from_addr, from_name,
       to_json, cc_json, reply_to, subject, snippet, attach_json, has_attach, size, seen, starred, date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, mailbox, opts.folder || 'inbox', p.messageId || null, p.inReplyTo || null, p.references || null,
    message.to ? message.to.toLowerCase() : null, (from.address || '').toLowerCase(), from.name || '',
    JSON.stringify(addrList(p.to)), JSON.stringify(addrList(p.cc)), p.replyTo?.[0]?.address || null,
    p.subject || '', snippetOf(p.text, p.html), JSON.stringify(attach), visibleAttach.length ? 1 : 0,
    message.rawSize || raw.byteLength, opts.seen ? 1 : 0, opts.starred ? 1 : 0, opts.date || Date.now()
  ).run();
  return id;
}

// Email Routing 的 email() 入口
export async function receive(message, env) {
  const rcpt = localPart(message.to);
  const domains = domainsOf(env);
  if (domains.length && !domains.includes(rcpt.split('@')[1])) {
    message.setReject('Domain not handled');
    return;
  }
  const r = await route(env, rcpt);
  if (r.reject) {
    await addLog(env, 'reject', message.from, rcpt, r.reject);
    message.setReject(r.reject);
    return;
  }

  // 收件邮箱各自的设置：停用、容量、转发、自动回复
  const size = message.rawSize || 0;
  const users = [];
  for (const box of r.boxes) {
    const u = await env.DB.prepare('SELECT * FROM users WHERE address = ?').bind(box).first();
    if (!u) { users.push({ address: box, keep: true }); continue; } // 兜底邮箱没有账号也照样存
    if (u.disabled) continue;
    if (u.quota_mb) {
      const used = (await env.DB.prepare('SELECT COALESCE(SUM(size), 0) AS n FROM messages WHERE mailbox = ?').bind(box).first()).n;
      if (used + size > u.quota_mb * 1048576) { await addLog(env, 'quota', message.from, box, '邮箱满了'); continue; }
    }
    const fwd = env.FWD_ON && u.fwd_to;
    if (fwd) r.forwards.set(u.fwd_to, u.fwd_mode || 'cf');
    users.push({ ...u, keep: !fwd || !!u.fwd_keep });
  }
  if (!users.some((u) => u.keep) && !r.forwards.size) {
    message.setReject('Mailbox full or disabled');
    return;
  }

  // 两种转发：cf 由 Cloudflare 原样转发，只能发给在「电子邮件路由 → 目标地址」验证过的邮箱;
  // send 用 Resend 重新发一封，不用验证，发件人是收信地址，回复会回到原发件人。没开通 Resend 时退回 cf。
  const viaSend = [];
  for (const [to, mode] of r.forwards) {
    if (mode === 'send' && env.RESEND_API_KEY) { viaSend.push(to); continue; }
    try {
      await message.forward(to);
      await addLog(env, 'forward', message.from, rcpt, `转发到 ${to}`);
    } catch (e) {
      await addLog(env, 'forward_fail', message.from, rcpt, `转发到 ${to} 失败：${e.message}`);
    }
  }

  const keep = users.filter((u) => u.keep);
  if (!keep.length && !viaSend.length) return;
  const raw = await new Response(message.raw).arrayBuffer();
  const p = await PostalMime.parse(raw);
  for (const to of viaSend) await forwardViaSend(env, p, message, rcpt, to);
  if (!keep.length) return;
  const from = p.from?.address ? p.from : { address: message.from, name: '' };
  const snippet = snippetOf(p.text, p.html);
  const nAtt = (p.attachments || []).filter((a) => !(a.disposition === 'inline' && a.contentId)).length;
  for (const u of keep) {
    const id = await store(env, u.address, p, raw, message);
    // Telegram 推送：绑定了才推；默认不推群发、通知类邮件
    if (u.tg_chat && env.TG_TOKEN && (u.tg_bulk || !isBulk(p))) {
      try { await tgNotify(env, u, { from, subject: p.subject, snippet, attachments: nAtt, rcpt, id }); }
      catch (e) { await addLog(env, 'tg_fail', message.from, u.address, `Telegram 推送失败：${e.message}`); }
    }
  }
  await addLog(env, 'deliver', message.from, rcpt, keep.map((u) => u.address).join(', ') + (r.via !== 'user' ? `(${r.via})` : ''));
  for (const u of users) if (u.ar_on) await autoReply(env, u, p, p.from?.address || message.from, rcpt);
}

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const textToHtml = (t) =>
  `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.6;white-space:pre-wrap">${esc(t)}</div>`;

function b64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

// 发信：设了 RESEND_API_KEY 走 Resend，否则走 Cloudflare Email Sending
// m: { from:{email,name}, to[], cc[], bcc[], subject, text, html, inReplyTo, references, attachments:[{filename,type,bytes}] }
export async function sendOut(env, m) {
  const headers = {};
  if (m.inReplyTo) headers['In-Reply-To'] = m.inReplyTo;
  if (m.references) headers['References'] = m.references;
  if (m.autoReply) headers['Auto-Submitted'] = 'auto-replied';
  for (const [k, v] of Object.entries(m.headers || {})) if (v) headers[k] = v;

  if (env.RESEND_API_KEY) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: m.from.name ? `${m.from.name} <${m.from.email}>` : m.from.email,
        to: m.to,
        cc: m.cc.length ? m.cc : undefined,
        bcc: m.bcc.length ? m.bcc : undefined,
        reply_to: m.replyTo || undefined,
        subject: m.subject,
        text: m.text || undefined,
        html: m.html || undefined,
        headers: Object.keys(headers).length ? headers : undefined,
        attachments: m.attachments.length
          ? m.attachments.map((a) => ({ filename: a.filename, content: b64(a.bytes), content_type: a.type, content_id: a.cid || undefined }))
          : undefined,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`Resend: ${j.message || r.status}`);
    return j.id;
  }

  if (!env.EMAIL) throw new Error('没有配置发信方式');
  const payload = {
    from: m.from.name ? m.from : m.from.email,
    to: m.to,
    subject: m.subject,
    text: m.text,
    html: m.html,
  };
  if (m.cc.length) payload.cc = m.cc;
  if (m.bcc.length) payload.bcc = m.bcc;
  if (m.attachments.length)
    payload.attachments = m.attachments.map((a) => ({
      content: b64(a.bytes),
      filename: a.filename,
      type: a.type,
      disposition: 'attachment',
    }));
  try {
    return (await env.EMAIL.send(Object.keys(headers).length ? { ...payload, headers } : payload)).messageId;
  } catch (e) {
    // 万一回复头不在允许列表里，去掉再发一次
    if (String(e.code || '').startsWith('E_HEADER')) return (await env.EMAIL.send(payload)).messageId;
    throw e;
  }
}
