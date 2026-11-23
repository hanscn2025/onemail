'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// 线条图标(24x24,描边)
const ICONS = {
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/>',
  star: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01Z"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/>',
  mailopen: '<path d="M21.2 8.4c.5.38.8.97.8 1.6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 .8-1.6l8-6a2 2 0 0 1 2.4 0l8 6Z"/><path d="m22 10-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 10"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  clip: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  reply: '<path d="M9 17 4 12l5-5"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>',
  replyall: '<path d="m7 17-5-5 5-5"/><path d="m12 17-5-5 5-5"/><path d="M22 18v-2a4 4 0 0 0-4-4H7"/>',
  forward: '<path d="m15 17 5-5-5-5"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  unread: '<path d="M22 10.5V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h12.5"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/><circle cx="19" cy="17" r="3"/>',
  restore: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  code: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
  file: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5Z"/><path d="M14 2v6h6"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>',
};
const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;
const fillIcons = (root = document) => $$('i[data-i]', root).forEach((el) => { el.outerHTML = icon(el.dataset.i); });

// 头像:取名字第一个字,颜色按地址固定
const AV_COLORS = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#2563eb', '#0d9488', '#ea580c'];
function avatar(name, addr) {
  const t = String(name || addr || '?').trim().replace(/^["'<]+/, '');
  const ch = (t.match(/[\p{L}\p{N}]/u) || ['?'])[0].toUpperCase();
  let h = 0; for (const c of String(addr || name)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `<span class="avatar" style="--av:${AV_COLORS[h % AV_COLORS.length]}">${esc(ch)}</span>`;
}
const FOLDER_NAMES = { inbox: '收件箱', starred: '星标', sent: '已发送', trash: '垃圾箱' };

const state = { me: null, folder: 'inbox', box: '', q: '', rcpt: '', items: [], cur: null, done: false };

async function api(path, opts = {}) {
  const o = { ...opts, headers: { ...(opts.headers || {}) } };
  if (o.method && o.method !== 'GET') o.headers['X-Mail'] = '1';
  if (o.json !== undefined) { o.body = JSON.stringify(o.json); o.headers['Content-Type'] = 'application/json'; delete o.json; }
  const r = await fetch('/api' + path, o);
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && path !== '/login') { showLogin(); throw new Error('未登录'); }
  if (!r.ok) throw new Error(data.error || `请求失败 (${r.status})`);
  return data;
}
const boxQ = () => (state.box && state.box !== state.me.address ? `mailbox=${encodeURIComponent(state.box)}` : '');
const withBox = (p) => { const b = boxQ(); return b ? p + (p.includes('?') ? '&' : '?') + b : p; };

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600);
}

function fmtDate(ms, full) {
  const d = new Date(ms), now = new Date();
  if (full) return d.toLocaleString('zh-CN', { hour12: false });
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}月${d.getDate()}日`;
  return d.toLocaleDateString('zh-CN');
}
const fmtSize = (n) => (n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(0) + ' KB' : (n / 1048576).toFixed(1) + ' MB');
const fmtAddr = (a) => (a.name ? `${a.name} <${a.address}>` : a.address);

// ---------- 登录 ----------
function showLogin() { $('#app').classList.add('hidden'); $('#login').classList.remove('hidden'); }
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  $('#loginErr').textContent = '';
  try {
    await api('/login', { method: 'POST', json: { address: f.get('address'), password: f.get('password') } });
    e.target.reset();
    await boot();
  } catch (x) { $('#loginErr').textContent = x.message; }
});
$('#logoutLink').onclick = async () => { await api('/logout', { method: 'POST' }).catch(() => {}); location.reload(); };

// ---------- 首次设置 ----------
const setupF = $('#setupForm');
setupF.domain.addEventListener('input', () => { $('#setupAt').textContent = '@' + (setupF.domain.value.trim().toLowerCase().replace(/^@/, '') || '域名'); });
setupF.addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#setupErr').textContent = '';
  if (setupF.password.value !== setupF.password2.value) { $('#setupErr').textContent = '两次密码不一样'; return; }
  try {
    const r = await api('/setup', { method: 'POST', json: { domain: setupF.domain.value, user: setupF.user.value, password: setupF.password.value } });
    $('#setup').classList.add('hidden');
    toast(`设置完成,管理员是 ${r.address}`);
    await boot();
  } catch (x) { $('#setupErr').textContent = x.message; }
});

async function boot() {
  try {
    const s = await api('/setup');
    if (s.needed) { $('#login').classList.add('hidden'); $('#setup').classList.remove('hidden'); return; }
  } catch {}
  try { state.me = await api('/me'); } catch { showLogin(); return; }
  $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
  $('#meAddr').textContent = state.me.address;
  $('#meName').textContent = state.me.name || state.me.address.split('@')[0];
  $('#meAvatar').outerHTML = avatar(state.me.name, state.me.address).replace('class="avatar"', 'class="avatar" id="meAvatar"');
  state.box = state.me.address;
  if (state.me.is_admin) {
    $('#adminLink').classList.remove('hidden');
    const sel = $('#boxSel');
    const boxes = [...new Set([state.me.address, ...(state.me.mailboxes || [])])];
    if (boxes.length > 1) {
      sel.innerHTML = boxes.map((b) => `<option value="${esc(b)}">${esc(b)}</option>`).join('');
      sel.value = state.box; sel.classList.remove('hidden');
    }
  }
  const h = location.hash.slice(1);
  if (['inbox', 'starred', 'sent', 'trash'].includes(h)) state.folder = h;
  await loadList();
}
$('#boxSel').onchange = (e) => { state.box = e.target.value; state.rcpt = ''; closeReader(); loadList(); };

// ---------- 列表 ----------
$$('#folders a').forEach((a) => (a.onclick = () => {
  state.folder = a.dataset.f; location.hash = state.folder; $('#app').classList.remove('menu');
  closeReader(); loadList();
}));
let searchT;
$('#search').addEventListener('input', (e) => { clearTimeout(searchT); searchT = setTimeout(() => { state.q = e.target.value.trim(); loadList(); }, 300); });
$('#refreshBtn').onclick = () => loadList();
$('#moreBtn').onclick = () => loadList(true);
$('#menuBtn').onclick = () => $('#app').classList.toggle('menu');

async function loadCounts() {
  const c = await api(withBox('/counts')).catch(() => ({}));
  $('[data-c="inbox"]').textContent = c.inbox || '';
  document.title = c.inbox ? `(${c.inbox}) OneMail` : 'OneMail';
}

async function loadList(more) {
  $$('#folders a').forEach((a) => a.classList.toggle('on', a.dataset.f === state.folder));
  $('#folderTitle').textContent = FOLDER_NAMES[state.folder];
  const last = more && state.items[state.items.length - 1];
  const p = new URLSearchParams({ folder: state.folder });
  if (state.q) p.set('q', state.q);
  if (state.rcpt && state.folder !== 'sent') p.set('rcpt', state.rcpt);
  if (last) p.set('before', last.date);
  try {
    const { items } = await api(withBox('/messages?' + p));
    state.items = more ? state.items.concat(items) : items;
    state.done = items.length < 50;
  } catch (x) { toast(x.message); }
  renderList(); loadCounts(); if (!more) loadRecipients();
}

// 收件地址筛选:这个邮箱收过两个以上地址的信时才显示
async function loadRecipients() {
  const sel = $('#rcptSel');
  if (state.folder === 'sent') { sel.classList.add('hidden'); return; }
  const { items } = await api(withBox('/recipients')).catch(() => ({ items: [] }));
  if (items.length < 2 && !state.rcpt) { sel.classList.add('hidden'); return; }
  sel.innerHTML = `<option value="">全部地址</option>` + items.map((x) =>
    `<option value="${esc(x.address)}">${esc(x.address)}${x.unread ? ` (${x.unread})` : ''}</option>`).join('');
  sel.value = state.rcpt; sel.classList.remove('hidden');
}
$('#rcptSel').onchange = (e) => { state.rcpt = e.target.value; closeReader(); loadList(); };

function renderList() {
  const el = $('#items');
  if (!state.items.length) {
    el.innerHTML = `<div class="empty">${icon(state.q ? 'search' : 'inbox')}<p>${state.q ? '没有找到相关的信' : '这里还没有信'}</p></div>`;
  } else {
    el.innerHTML = state.items.map((m) => {
      const sent = m.folder === 'sent' || state.folder === 'sent';
      const first = (m.to || [])[0] || {};
      const who = sent ? '发给 ' + (m.to || []).map((a) => a.name || a.address).join(', ') : m.from_name || m.from_addr;
      const av = sent ? avatar(first.name, first.address) : avatar(m.from_name, m.from_addr);
      const tag = m.envelope_to && m.envelope_to !== (state.box || state.me.address) && !sent ? `<span class="rcpt" title="发给 ${esc(m.envelope_to)}">${esc(m.envelope_to.split('@')[0])}</span>` : '';
      return `<div class="item ${m.seen ? '' : 'unread'} ${state.cur?.id === m.id ? 'sel' : ''}" data-id="${m.id}">
        ${av}
        <div class="item-main">
          <div class="item-top"><span class="who">${esc(who)}</span><span class="when">${m.has_attach ? icon('clip', 'sm') : ''}${m.starred ? icon('star', 'sm on') : ''}${fmtDate(m.date)}</span></div>
          <div class="subj">${tag}${esc(m.subject || '(无主题)')}</div>
          <div class="snip">${esc(m.snippet)}</div>
        </div></div>`;
    }).join('');
  }
  $('#moreBtn').classList.toggle('hidden', state.done);
  $$('.item', el).forEach((n) => (n.onclick = () => openMsg(n.dataset.id)));
}

// ---------- 读信 ----------
function closeReader() {
  state.cur = null; $('#app').classList.remove('reading');
  $('#reader').innerHTML = `<div class="empty">${icon('mailopen')}<p>选一封信来看</p></div>`;
}

async function openMsg(id, showImages = false) {
  let m;
  try { m = await api(`/messages/${id}`); } catch (x) { toast(x.message); return; }
  state.cur = m;
  const it = state.items.find((x) => x.id === id); if (it) it.seen = 1;
  renderList(); loadCounts();
  $('#app').classList.add('reading');

  const atts = m.attachments.filter((a) => !(a.inline && a.cid && m.html.includes('cid:' + a.cid)));
  const hasRemote = /<img[^>]+src\s*=\s*["']?https?:/i.test(m.html) || /url\(\s*["']?https?:/i.test(m.html);
  const trash = m.folder === 'trash';
  $('#reader').innerHTML = `
    <div class="r-tools">
      <button class="icon-btn mobile-back" data-a="back" title="返回" aria-label="返回">${icon('back')}</button>
      <div class="tool-group">
        <button class="tb" data-a="reply" title="回复">${icon('reply')}<span>回复</span></button>
        <button class="tb" data-a="replyall" title="全部回复">${icon('replyall')}<span>全部回复</span></button>
        <button class="tb" data-a="forward" title="转发">${icon('forward')}<span>转发</span></button>
      </div>
      <span class="spacer"></span>
      <button class="icon-btn ${m.starred ? 'starred' : ''}" data-a="star" title="${m.starred ? '取消星标' : '加星标'}" aria-label="星标">${icon('star')}</button>
      <button class="icon-btn" data-a="unread" title="标为未读" aria-label="标为未读">${icon('unread')}</button>
      ${m.folder === 'sent' ? '' : `<a class="icon-btn" href="/api/messages/${m.id}/raw" title="下载原始邮件" aria-label="原始邮件">${icon('code')}</a>`}
      ${trash ? `<button class="icon-btn" data-a="restore" title="移回" aria-label="移回">${icon('restore')}</button><button class="icon-btn danger" data-a="destroy" title="彻底删除" aria-label="彻底删除">${icon('trash')}</button>` : `<button class="icon-btn" data-a="trash" title="删除" aria-label="删除">${icon('trash')}</button>`}
    </div>
    <div class="r-head">
      <h2>${esc(m.subject || '(无主题)')}</h2>
      <div class="r-from">
        ${avatar(m.from_name, m.from_addr)}
        <div class="r-meta">
          <div class="r-line"><strong>${esc(m.from_name || m.from_addr)}</strong>${m.from_name ? `<span class="muted">&lt;${esc(m.from_addr)}&gt;</span>` : ''}<span class="r-date">${fmtDate(m.date, true)}</span></div>
          <div>收件人:${esc(m.to.map(fmtAddr).join(', ') || m.envelope_to || '')}</div>
          ${m.cc.length ? `<div>抄送:${esc(m.cc.map(fmtAddr).join(', '))}</div>` : ''}
          ${m.envelope_to && !m.to.some((a) => a.address === m.envelope_to) ? `<div>投递到:<span class="rcpt">${esc(m.envelope_to)}</span></div>` : ''}
        </div>
      </div>
    </div>
    ${m.html && hasRemote && !showImages ? `<div class="notice">${icon('shield')}<span>已挡住外部图片,它们可能用来追踪你是否读过这封信。</span><a data-a="images">显示图片</a></div>` : ''}
    <div class="r-body" id="rBody"></div>
    ${atts.length ? `<div class="atts">${atts.map((a) => `<a class="att" href="/api/messages/${m.id}/att/${a.i}?dl=1" title="${esc(a.filename)}">${icon('file')}<span class="att-name">${esc(a.filename)}</span><span class="muted">${fmtSize(a.size)}</span></a>`).join('')}</div>` : ''}`;
  $('.mobile-back').style.display = window.innerWidth <= 1100 ? '' : 'none';

  const body = $('#rBody');
  if (m.html) {
    const ifr = document.createElement('iframe');
    // 不给 allow-scripts:信里的脚本一律不跑;allow-same-origin 只用来量高度
    ifr.setAttribute('sandbox', 'allow-same-origin allow-popups allow-popups-to-escape-sandbox');
    ifr.setAttribute('referrerpolicy', 'no-referrer');
    let html = m.html;
    for (const a of m.attachments) if (a.cid) html = html.split('cid:' + a.cid).join(`${location.origin}/api/messages/${m.id}/att/${a.i}`);
    const img = showImages ? `${location.origin} data: https: http:` : `${location.origin} data:`;
    const csp = `default-src 'none'; img-src ${img}; style-src 'unsafe-inline'${showImages ? ' https:' : ''}; font-src data:${showImages ? ' https:' : ''}`;
    ifr.srcdoc = `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank">
      <style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;font-size:14px;color:#111;word-wrap:break-word}img{max-width:100%;height:auto}</style>${html}`;
    ifr.onload = () => {
      const fit = () => { try { ifr.style.height = ifr.contentDocument.documentElement.scrollHeight + 20 + 'px'; } catch {} };
      fit(); setTimeout(fit, 400); setTimeout(fit, 1500);
    };
    body.appendChild(ifr);
  } else {
    const pre = document.createElement('pre'); pre.textContent = m.text || '(没有正文)'; body.appendChild(pre);
  }

  $$('[data-a]', $('#reader')).forEach((b) => (b.onclick = () => act(b.dataset.a)));
}

async function act(a) {
  const m = state.cur; if (!m) return;
  try {
    if (a === 'back') return closeReader();
    if (a === 'images') return openMsg(m.id, true);
    if (a === 'reply' || a === 'replyall' || a === 'forward') return openCompose(a, m);
    if (a === 'star') { await api(`/messages/${m.id}`, { method: 'PATCH', json: { starred: !m.starred } }); await loadList(); return openMsg(m.id); }
    if (a === 'unread') { await api(`/messages/${m.id}`, { method: 'PATCH', json: { seen: false } }); closeReader(); return loadList(); }
    if (a === 'trash') { await api(`/messages/${m.id}`, { method: 'PATCH', json: { folder: 'trash' } }); toast('已移到垃圾箱'); }
    if (a === 'restore') { await api(`/messages/${m.id}`, { method: 'PATCH', json: { folder: 'restore' } }); toast('已移回'); }
    if (a === 'destroy') { if (!confirm('彻底删除后不能恢复,确定吗?')) return; await api(`/messages/${m.id}`, { method: 'DELETE' }); toast('已删除'); }
    closeReader(); loadList();
  } catch (x) { toast(x.message); }
}

// ---------- 写信 ----------
const dlg = $('#composeDlg'), cf = $('#composeForm');
$$('[data-close]').forEach((b) => (b.onclick = () => b.closest('dialog').close()));
$('#composeBtn').onclick = () => openCompose('new');
cf.files.onchange = () => { $('#fileNames').textContent = [...cf.files.files].map((f) => f.name).join(', '); };

function quote(m) {
  const head = `\n\n\n在 ${fmtDate(m.date, true)},${fmtAddr({ name: m.from_name, address: m.from_addr })} 写道:\n`;
  let t = m.text;
  if (!t && m.html) { const d = document.createElement('div'); d.innerHTML = m.html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ''); t = d.innerText; }
  return head + (t || '').split('\n').map((l) => '> ' + l).join('\n');
}

function openCompose(kind, m) {
  if (!state.me.can_send) {
    toast(state.me.is_admin ? '还没开通发信:到「邮箱账号管理 → 发信」填 Resend Key' : '还没开通发信,请联系管理员');
    return;
  }
  cf.reset(); $('#fileNames').textContent = ''; $('#sendErr').textContent = '';
  cf.reply_to_id.value = '';
  const myBox = state.box || state.me.address;
  // 管理员查看别的邮箱时,可以用那个邮箱的地址发信
  const domains = state.me.domains || [];
  const gotAt = m && m.folder !== 'sent' && m.envelope_to && state.me.is_admin && domains.includes(m.envelope_to.split('@')[1]) ? m.envelope_to : null;
  const fromOpts = [...new Set([gotAt, myBox, state.me.address].filter(Boolean))];
  $('#fromRow').classList.toggle('hidden', fromOpts.length < 2);
  $('#fromSel').innerHTML = fromOpts.map((a) => `<option>${esc(a)}</option>`).join('');
  $('#fromSel').value = kind === 'forward' ? myBox : gotAt || myBox;
  $('#composeTitle').textContent = { new: '写信', reply: '回复', replyall: '全部回复', forward: '转发' }[kind];
  if (m) {
    const subj = m.subject || '';
    if (kind === 'forward') {
      cf.subject.value = /^(fwd?|转发)\s*[:：]/i.test(subj) ? subj : 'Fwd: ' + subj;
      cf.text.value = '\n\n---------- 转发的邮件 ----------\n' +
        `发件人:${fmtAddr({ name: m.from_name, address: m.from_addr })}\n日期:${fmtDate(m.date, true)}\n主题:${subj}\n收件人:${m.to.map(fmtAddr).join(', ')}\n` +
        quote(m).replace(/^\n+[^\n]*\n/, '\n');
      if (m.attachments.length) $('#fileNames').textContent = '(原信附件不会自动带上)';
    } else {
      cf.subject.value = /^(re|回复)\s*[:：]/i.test(subj) ? subj : 'Re: ' + subj;
      const back = m.folder === 'sent' ? m.to.map((a) => a.address) : [m.reply_to || m.from_addr];
      cf.to.value = back.join(', ');
      if (kind === 'replyall') {
        const mine = new Set([state.me.address, myBox]);
        cf.cc.value = [...m.to, ...m.cc].map((a) => a.address).filter((a) => !mine.has(a) && !back.includes(a)).join(', ');
      }
      cf.text.value = quote(m);
      cf.reply_to_id.value = m.id;
    }
  }
  dlg.showModal();
  (cf.to.value ? cf.text : cf.to).focus();
  if (cf.to.value) cf.text.setSelectionRange(0, 0);
}

cf.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#sendBtn'); btn.disabled = true; btn.lastElementChild.textContent = '发送中…'; $('#sendErr').textContent = '';
  try {
    const fd = new FormData(cf);
    const r = await fetch('/api/send', { method: 'POST', body: fd, headers: { 'X-Mail': '1' } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `发送失败 (${r.status})`);
    dlg.close(); toast('已发送');
    if (state.folder === 'sent') loadList();
  } catch (x) { $('#sendErr').textContent = x.message; }
  finally { btn.disabled = false; btn.lastElementChild.textContent = '发送'; }
});

// ---------- 设置 ----------
$('#settingsLink').onclick = () => { $('#nameForm').dname.value = state.me.name || ''; $('#settingsMsg').textContent = ''; $('#settingsDlg').showModal(); };
$('#nameForm').onsubmit = async (e) => {
  e.preventDefault();
  try { await api('/profile', { method: 'POST', json: { name: e.target.dname.value } }); state.me.name = e.target.dname.value; $('#settingsMsg').textContent = '已保存'; }
  catch (x) { $('#settingsMsg').textContent = x.message; }
};
$('#pwForm').onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  try { await api('/password', { method: 'POST', json: { old: f.get('old'), password: f.get('password') } }); e.target.reset(); $('#settingsMsg').textContent = '密码已修改,其他设备需要重新登录'; }
  catch (x) { $('#settingsMsg').textContent = x.message; }
};

// ---------- 管理 ----------
$('#adminLink').onclick = () => { $('#adminDlg').showModal(); loadUsers(); loadSend(); };

async function loadSend() {
  const r = await api('/admin/send');
  $('#sendStatus').textContent = {
    secret: `已开通,用的是 Worker 机密里的 Key(…${r.tail}),这里改不了`,
    settings: `已开通,Key 结尾 …${r.tail}`,
    cloudflare: '用的是 Cloudflare 发信(需要 Workers 付费版)。填了 Resend Key 会改用 Resend',
  }[r.source] || '还没开通。填一个 Resend API Key 就能发信';
  $('#resendForm').classList.toggle('hidden', r.source === 'secret');
  $('#resendClear').classList.toggle('hidden', r.source !== 'settings');
}
async function saveResend(key) {
  try {
    const r = await api('/admin/send', { method: 'POST', json: { key } });
    $('#resendForm').reset(); toast(r.note);
    state.me = await api('/me');
    loadSend();
  } catch (x) { toast(x.message); }
}
$('#resendForm').addEventListener('submit', (e) => { e.preventDefault(); const k = e.target.key.value.trim(); if (k) saveResend(k); });
$('#resendClear').onclick = () => { if (confirm('清除后就不能发信了,确定吗?')) saveResend(''); };
async function loadUsers() {
  const { items, domains, catch_all } = await api('/admin/users');
  $('#domainSuffix').textContent = '@' + domains[0];
  $('#adminMsg').textContent = catch_all ? `发到不存在地址的信会进入 ${catch_all}` : '发到不存在地址的信会被退回';
  $('#userRows').innerHTML = items.map((u) => `<tr><td>${esc(u.address)}${u.is_admin ? ' <span class="muted">(管理员)</span>' : ''}</td><td>${esc(u.name)}</td><td>${u.total}</td>
    <td><button data-pw="${u.id}">重设密码</button> ${u.address === state.me.address ? '' : `<button data-del="${u.id}" data-addr="${esc(u.address)}">删除</button>`}</td></tr>`).join('');
  $$('[data-pw]').forEach((b) => (b.onclick = async () => {
    const p = prompt('新密码(至少 10 位)'); if (!p) return;
    try { await api(`/admin/users/${b.dataset.pw}/password`, { method: 'POST', json: { password: p } }); toast('密码已重设'); } catch (x) { toast(x.message); }
  }));
  $$('[data-del]').forEach((b) => (b.onclick = async () => {
    if (!confirm(`删除账号 ${b.dataset.addr}?已收的信会保留,但之后发到这个地址的信不再收。`)) return;
    try { await api(`/admin/users/${b.dataset.del}`, { method: 'DELETE' }); loadUsers(); } catch (x) { toast(x.message); }
  }));
}
$('#newUserForm').onsubmit = async (e) => {
  e.preventDefault();
  const f = e.target;
  try {
    await api('/admin/users', { method: 'POST', json: {
      address: f.local.value.trim() + $('#domainSuffix').textContent, name: f.dname.value, password: f.password.value, is_admin: f.is_admin.checked,
    } });
    f.reset(); toast('已创建'); loadUsers();
  } catch (x) { $('#adminMsg').textContent = x.message; }
};

// ---------- 批量创建 ----------
function genPassword() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  return [...crypto.getRandomValues(new Uint32Array(14))].map((n) => abc[n % abc.length]).join('');
}
let batchResults = [];
$('#batchForm').onsubmit = async (e) => {
  e.preventDefault();
  const domain = $('#domainSuffix').textContent; // 形如 @example.com
  const rows = e.target.lines.value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const [user, pw, ...name] = l.split(/[,，\t]/).map((x) => x.trim());
    const local = user.toLowerCase().replace(/@.*$/, '');
    return { address: local + domain, password: pw || genPassword(), name: name.join(' '), generated: !pw };
  });
  if (!rows.length) return;
  if (rows.length > 500) { $('#batchMsg').textContent = '一次最多 500 个'; return; }
  const btn = $('#batchBtn'); btn.disabled = true;
  const tbody = $('#batchTable tbody'); tbody.innerHTML = ''; $('#batchTable').classList.remove('hidden');
  batchResults = [];
  let ok = 0;
  for (const [i, r] of rows.entries()) {
    $('#batchMsg').textContent = `正在创建 ${i + 1}/${rows.length}…`;
    if (r.password.length < 10) r.result = '密码不到 10 位';
    else {
      try { await api('/admin/users', { method: 'POST', json: { address: r.address, password: r.password, name: r.name } }); r.result = '成功'; ok++; }
      catch (x) { r.result = x.message; }
    }
    batchResults.push(r);
    tbody.insertAdjacentHTML('beforeend', `<tr><td>${esc(r.address)}</td><td>${r.result === '成功' ? esc(r.password) : ''}</td><td>${esc(r.result)}</td></tr>`);
  }
  $('#batchMsg').textContent = `完成:成功 ${ok} 个,失败 ${rows.length - ok} 个。密码只显示这一次,请下载保存。`;
  $('#batchCsv').classList.toggle('hidden', !ok);
  btn.disabled = false;
  if (ok) e.target.lines.value = '';
  loadUsers();
};
$('#batchCsv').onclick = () => {
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = '﻿地址,密码,显示名称,结果\n' + batchResults.map((r) => [r.address, r.result === '成功' ? r.password : '', r.name, r.result].map(q).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `mail-accounts-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

fillIcons();
boot();
