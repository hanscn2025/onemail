// 收信入库、发信
import PostalMime from 'postal-mime';

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

// Email Routing 的 email() 入口
export async function receive(message, env) {
  const rcpt = localPart(message.to);
  const domains = (env.DOMAINS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (domains.length && !domains.includes(rcpt.split('@')[1])) {
    message.setReject('Domain not handled');
    return;
  }
  const user = await env.DB.prepare('SELECT address FROM users WHERE address = ?').bind(rcpt).first();
  const mailbox = user?.address || (env.CATCH_ALL || '').trim().toLowerCase();
  if (!mailbox) {
    message.setReject('Address not found');
    return;
  }

  const raw = await new Response(message.raw).arrayBuffer();
  const p = await PostalMime.parse(raw);
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
       to_json, cc_json, reply_to, subject, snippet, attach_json, has_attach, size, date)
     VALUES (?, ?, 'inbox', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      mailbox,
      p.messageId || null,
      p.inReplyTo || null,
      p.references || null,
      message.to.toLowerCase(),
      (from.address || '').toLowerCase(),
      from.name || '',
      JSON.stringify(addrList(p.to)),
      JSON.stringify(addrList(p.cc)),
      p.replyTo?.[0]?.address || null,
      p.subject || '',
      snippetOf(p.text, p.html),
      JSON.stringify(attach),
      visibleAttach.length ? 1 : 0,
      message.rawSize || raw.byteLength,
      Date.now()
    )
    .run();
}

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const textToHtml = (t) =>
  `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.6;white-space:pre-wrap">${esc(t)}</div>`;

function b64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

// 发信:设了 RESEND_API_KEY 走 Resend,否则走 Cloudflare Email Sending
// m: { from:{email,name}, to[], cc[], bcc[], subject, text, html, inReplyTo, references, attachments:[{filename,type,bytes}] }
export async function sendOut(env, m) {
  const headers = {};
  if (m.inReplyTo) headers['In-Reply-To'] = m.inReplyTo;
  if (m.references) headers['References'] = m.references;

  if (env.RESEND_API_KEY) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: m.from.name ? `${m.from.name} <${m.from.email}>` : m.from.email,
        to: m.to,
        cc: m.cc.length ? m.cc : undefined,
        bcc: m.bcc.length ? m.bcc : undefined,
        subject: m.subject,
        text: m.text,
        html: m.html,
        headers: Object.keys(headers).length ? headers : undefined,
        attachments: m.attachments.length
          ? m.attachments.map((a) => ({ filename: a.filename, content: b64(a.bytes), content_type: a.type }))
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
    // 万一回复头不在允许列表里,去掉再发一次
    if (String(e.code || '').startsWith('E_HEADER')) return (await env.EMAIL.send(payload)).messageId;
    throw e;
  }
}
