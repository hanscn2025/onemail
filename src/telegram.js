// Telegram 通知:新邮件推送到绑定的 Telegram 聊天。
// 管理员在「管理中心 → 通知」填机器人 Token;每个人在「设置 → 通知」点链接跳到机器人完成绑定。
// 不经过邮件路由,不用在 Cloudflare 验证任何地址,也不占发信额度。

export async function tgCall(token, method, payload) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    });
    return await r.json().catch(() => ({ ok: false, description: `HTTP ${r.status}` }));
  } catch (e) {
    return { ok: false, description: `连不上 Telegram:${e.message}` };
  }
}

const h = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const LINK_TTL = 15 * 60000;

// 群发、通知类邮件(有 List-Id、Precedence: bulk 等)
export function isBulk(p) {
  const hd = Object.fromEntries((p.headers || []).map((x) => [x.key, String(x.value || '').toLowerCase()]));
  return !!(hd['list-id'] || hd['list-unsubscribe'] || /bulk|list|junk/.test(hd['precedence'] || ''));
}

// u: 用户行(tg_chat、tg_body);info: { from:{name,address}, subject, snippet, attachments, rcpt, id }
export async function tgNotify(env, u, info) {
  const f = info.from || {};
  const who = f.name ? `<b>${h(f.name)}</b> &lt;${h(f.address)}&gt;` : `<b>${h(f.address || '未知发件人')}</b>`;
  const lines = [`📩 ${who}`, `收信:${h(info.rcpt)}`, '', `<b>${h(info.subject || '(无主题)')}</b>`];
  if (u.tg_body && info.snippet) lines.push(h(info.snippet));
  if (info.attachments) lines.push(`📎 ${info.attachments} 个附件`);
  const payload = {
    chat_id: u.tg_chat,
    text: lines.join('\n').slice(0, 4000),
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
  };
  // Telegram 的按钮链接必须是公网 https 地址
  if (info.id && /^https:\/\//.test(env.APP_URL || '')) {
    payload.reply_markup = { inline_keyboard: [[{ text: '打开邮件', url: `${env.APP_URL}/#msg/${info.id}` }]] };
  }
  const j = await tgCall(env.TG_TOKEN, 'sendMessage', payload);
  if (!j.ok) throw new Error(j.description || 'Telegram 发送失败');
}

// 生成一次性绑定链接:t.me/机器人?start=随机码,15 分钟内有效
export async function tgLink(env, userId) {
  const code = [...crypto.getRandomValues(new Uint8Array(18))].map((b) => b.toString(16).padStart(2, '0')).join('');
  await env.DB.prepare('DELETE FROM tg_links WHERE user_id = ? OR at < ?').bind(userId, Date.now() - LINK_TTL).run();
  await env.DB.prepare('INSERT INTO tg_links (code, user_id, at) VALUES (?, ?, ?)').bind(code, userId, Date.now()).run();
  return `https://t.me/${env.TG_BOT}?start=${code}`;
}

// 机器人收到的消息:/start 绑定码 → 绑定;/stop → 解除;其他 → 说明
export async function tgWebhook(request, env) {
  if (!env.TG_TOKEN || !env.TG_SECRET || request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.TG_SECRET) {
    return new Response('forbidden', { status: 403 });
  }
  const up = await request.json().catch(() => ({}));
  const msg = up.message;
  if (!msg?.chat || msg.chat.type !== 'private') return new Response('ok');
  const chat = String(msg.chat.id);
  const text = String(msg.text || '').trim();
  const reply = (t) => tgCall(env.TG_TOKEN, 'sendMessage', { chat_id: chat, text: t });

  const m = text.match(/^\/start(?:@\w+)?\s+([a-f0-9]{16,64})$/i);
  if (m) {
    const row = await env.DB.prepare('SELECT user_id, at FROM tg_links WHERE code = ?').bind(m[1]).first();
    await env.DB.prepare('DELETE FROM tg_links WHERE code = ? OR at < ?').bind(m[1], Date.now() - LINK_TTL).run();
    const u = row && row.at > Date.now() - LINK_TTL
      ? await env.DB.prepare('SELECT id, address FROM users WHERE id = ?').bind(row.user_id).first()
      : null;
    if (!u) await reply('绑定链接已失效。请回到 OneMail「设置 → 通知」重新点「绑定 Telegram」。');
    else {
      await env.DB.prepare('UPDATE users SET tg_chat = ? WHERE id = ?').bind(chat, u.id).run();
      await reply(`已绑定 ${u.address},新邮件会推送到这里。\n发送 /stop 解除绑定。`);
    }
  } else if (/^\/stop/i.test(text)) {
    const r = await env.DB.prepare("UPDATE users SET tg_chat = '' WHERE tg_chat = ?").bind(chat).run();
    await reply(r.meta?.changes ? '已解除绑定,不会再推送新邮件。' : '这个 Telegram 账号没有绑定邮箱。');
  } else {
    const r = await env.DB.prepare('SELECT address FROM users WHERE tg_chat = ?').bind(chat).all();
    const list = (r.results || []).map((x) => x.address);
    await reply(list.length
      ? `已绑定:${list.join('、')}\n发送 /stop 解除绑定。`
      : '请在 OneMail「设置 → 通知」里点「绑定 Telegram」完成绑定。');
  }
  return new Response('ok');
}
