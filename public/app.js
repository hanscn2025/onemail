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
  shuffle: '<path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  power: '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.77.04"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
  dice: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 16V11M12 16V7M17 16v-3"/>',
  route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  at: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
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
// ---------- 品牌 ----------
const DEFAULT_LOGO = document.querySelector('.logo')?.innerHTML || '';
const DEFAULT_ICON = document.querySelector('link[rel=icon]')?.href || '';
function applyBrand(b) {
  state.brand = b;
  const name = b.name || 'OneMail';
  $$('.brand-name, .card-brand span').forEach((el) => (el.textContent = name));
  $('#loginForm h1').textContent = `登录 ${name}`;
  $$('.logo').forEach((el) => {
    el.classList.toggle('has-img', !!b.logo);
    el.innerHTML = b.logo ? `<img src="${esc(b.logo)}" alt="">` : DEFAULT_LOGO;
  });
  const link = document.querySelector('link[rel=icon]');
  if (link) link.href = b.logo || DEFAULT_ICON;
  document.title = name;
}
const brandName = () => (state.brand && state.brand.name) || 'OneMail';

const FOLDER_NAMES = { inbox: '收件箱', starred: '星标', sent: '已发送', drafts: '草稿', trash: '垃圾箱' };

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
  for (const id of ['meAvatar', 'meAvatar2']) $('#' + id).outerHTML = avatar(state.me.name, state.me.address).replace('class="avatar"', `class="avatar" id="${id}"`);
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
  if (['inbox', 'starred', 'sent', 'drafts', 'trash'].includes(h)) state.folder = h;
  if (h === 'temp' || h === 'settings' || (h.startsWith('admin') && state.me.is_admin)) { openPage(h); return; }
  await loadList();
}
$('#boxSel').onchange = (e) => { state.box = e.target.value; state.rcpt = ''; closeReader(); loadList(); };

// ---------- 列表 ----------
$$('#folders a').forEach((a) => (a.onclick = () => {
  state.folder = a.dataset.f; location.hash = state.folder; $('#app').classList.remove('menu');
  closePage(); closeReader(); loadList();
}));
let searchT;
$('#search').addEventListener('input', (e) => { clearTimeout(searchT); searchT = setTimeout(() => { state.q = e.target.value.trim(); loadList(); }, 300); });
$('#refreshBtn').onclick = () => loadList();
$('#moreBtn').onclick = () => loadList(true);
// 菜单按钮:手机上滑出侧栏,电脑上收起或展开侧栏
$('#menuBtn').onclick = () => $('#app').classList.toggle(window.innerWidth <= 720 ? 'menu' : 'collapsed');
$('#scrim').onclick = () => $('#app').classList.remove('menu');
// 头像菜单
$('#meBtn').onclick = (e) => { e.stopPropagation(); $('#meMenu').classList.toggle('hidden'); };
document.addEventListener('click', (e) => { if (!e.target.closest('.me-wrap')) $('#meMenu').classList.add('hidden'); });

async function loadCounts() {
  const c = await api(withBox('/counts')).catch(() => ({}));
  $('[data-c="inbox"]').textContent = c.inbox || '';
  document.title = c.inbox ? `(${c.inbox}) ${brandName()}` : brandName();
}

async function loadList(more) {
  $$('#folders a').forEach((a) => a.classList.toggle('on', a.dataset.f === state.folder));
  $('#folderTitle').textContent = FOLDER_NAMES[state.folder];
  const last = more && state.items[state.items.length - 1];
  const p = new URLSearchParams({ folder: state.folder });
  if (state.q) p.set('q', state.q);
  if (state.rcpt && state.folder !== 'sent' && state.folder !== 'drafts') p.set('rcpt', state.rcpt);
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
  if (state.folder === 'sent' || state.folder === 'drafts') { sel.classList.add('hidden'); return; }
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
      const sent = ['sent', 'drafts'].includes(m.folder) || ['sent', 'drafts'].includes(state.folder);
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
  $$('.item', el).forEach((n) => (n.onclick = () => (state.folder === 'drafts' ? openDraft(n.dataset.id) : openMsg(n.dataset.id))));
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
    toast(state.me.is_admin ? '还没开通发信:到「管理后台 → 发信」填 Resend Key' : '还没开通发信,请联系管理员');
    return;
  }
  cf.reset(); $('#fileNames').textContent = ''; $('#sendErr').textContent = '';
  cf.reply_to_id.value = ''; cf.draft_id.value = '';
  const myBox = state.box || state.me.address;
  // 发件人:自己的地址、别名、临时地址;回复发到别名或临时地址的信时默认用那个地址
  const domains = state.me.domains || [];
  const gotAt = m && m.folder !== 'sent' && m.envelope_to && domains.includes(m.envelope_to.split('@')[1])
    && (state.me.is_admin || state.me.from.includes(m.envelope_to)) ? m.envelope_to : null;
  const draftFrom = kind === 'draft' && m.draft ? m.draft.from : null;
  const own = state.me.is_admin ? myBox : state.me.address;
  const fromOpts = [...new Set([draftFrom, gotAt, own, ...state.me.from].filter(Boolean))];
  $('#fromRow').classList.toggle('hidden', fromOpts.length < 2);
  $('#fromSel').innerHTML = fromOpts.map((a) => `<option>${esc(a)}</option>`).join('');
  $('#fromSel').value = draftFrom || (kind === 'forward' ? own : gotAt || own);
  $('#composeTitle').textContent = { new: '写信', reply: '回复', replyall: '全部回复', forward: '转发', draft: '编辑草稿' }[kind];
  const sig = state.me.signature ? '\n\n' + state.me.signature : '';
  if (kind === 'draft') {
    cf.to.value = m.to.map((a) => a.address).join(', ');
    cf.cc.value = m.cc.map((a) => a.address).join(', ');
    cf.bcc.value = ((m.draft && m.draft.bcc) || []).map((a) => a.address).join(', ');
    cf.subject.value = m.subject || '';
    cf.text.value = m.text || '';
    cf.reply_to_id.value = (m.draft && m.draft.reply_to_id) || '';
    cf.draft_id.value = m.id;
  } else if (m) {
    const subj = m.subject || '';
    if (kind === 'forward') {
      cf.subject.value = /^(fwd?|转发)\s*[:：]/i.test(subj) ? subj : 'Fwd: ' + subj;
      cf.text.value = sig + '\n\n---------- 转发的邮件 ----------\n' +
        `发件人:${fmtAddr({ name: m.from_name, address: m.from_addr })}\n日期:${fmtDate(m.date, true)}\n主题:${subj}\n收件人:${m.to.map(fmtAddr).join(', ')}\n` +
        quote(m).replace(/^\n+[^\n]*\n/, '\n');
      if (m.attachments.length) $('#fileNames').textContent = '(原信附件不会自动带上)';
    } else {
      cf.subject.value = /^(re|回复)\s*[:：]/i.test(subj) ? subj : 'Re: ' + subj;
      const back = m.folder === 'sent' ? m.to.map((a) => a.address) : [m.reply_to || m.from_addr];
      cf.to.value = back.join(', ');
      if (kind === 'replyall') {
        const mine = new Set([state.me.address, myBox, ...state.me.from]);
        cf.cc.value = [...m.to, ...m.cc].map((a) => a.address).filter((a) => !mine.has(a) && !back.includes(a)).join(', ');
      }
      cf.text.value = sig + quote(m);
      cf.reply_to_id.value = m.id;
    }
  } else {
    cf.text.value = sig;
  }
  dlg.showModal();
  (cf.to.value ? cf.text : cf.to).focus();
  if (cf.to.value) cf.text.setSelectionRange(0, 0);
}

async function openDraft(id) {
  try { openCompose('draft', await api(`/messages/${id}`)); } catch (x) { toast(x.message); }
}

$('#draftBtn').onclick = async () => {
  try {
    const r = await fetch('/api/drafts', { method: 'POST', body: new FormData(cf), headers: { 'X-Mail': '1' } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || '保存失败');
    cf.draft_id.value = j.id;
    toast(cf.files.files.length ? '草稿已保存(附件不会存进草稿)' : '草稿已保存');
    if (state.folder === 'drafts') loadList();
  } catch (x) { $('#sendErr').textContent = x.message; }
};

cf.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#sendBtn'); btn.disabled = true; btn.lastElementChild.textContent = '发送中…'; $('#sendErr').textContent = '';
  try {
    const fd = new FormData(cf);
    const r = await fetch('/api/send', { method: 'POST', body: fd, headers: { 'X-Mail': '1' } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `发送失败 (${r.status})`);
    dlg.close(); toast('已发送');
    if (state.folder === 'sent' || state.folder === 'drafts') loadList();
  } catch (x) { $('#sendErr').textContent = x.message; }
  finally { btn.disabled = false; btn.lastElementChild.textContent = '发送'; }
});

// ---------- 页面:临时邮箱、设置、管理后台 ----------
const page = $('#page');
const DAY_MS = 86400000;
const copyText = async (t) => { try { await navigator.clipboard.writeText(t); toast(`已复制 ${t}`); } catch { toast(t); } };
const badge = (cls, text) => `<span class="badge ${cls}">${esc(text)}</span>`;
const ago = (ms) => (ms ? fmtDate(ms) : '—');
const fmtDay = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function closePage() {
  $('#app').classList.remove('paging');
  page.classList.add('hidden'); page.innerHTML = '';
  $$('[data-p]').forEach((a) => a.classList.remove('on'));
}

async function openPage(name) {
  const [base, tab] = name.split('/');
  if (!PAGES[base]) return;
  $('#app').classList.add('paging'); $('#app').classList.remove('menu', 'reading');
  page.classList.remove('hidden');
  $$('#folders a').forEach((a) => a.classList.remove('on'));
  $$('[data-p]').forEach((a) => a.classList.toggle('on', a.dataset.p === base));
  if (location.hash.slice(1) !== name) history.replaceState(null, '', '#' + name);
  try { await PAGES[base](tab); } catch (x) { toast(x.message); }
}
$$('[data-p]').forEach((a) => (a.onclick = () => openPage(a.dataset.p)));

function head(title, desc, right = '') {
  return `<header class="page-head">
    <div class="page-title"><h1>${title}</h1>${desc ? `<p class="muted">${desc}</p>` : ''}</div>${right}</header>`;
}
function wire(root = page) {
  $('#meMenu').classList.add('hidden');
}

// 通用编辑弹窗:fields 是表单 HTML,onSave(FormData) 抛错时显示在弹窗里
function editDialog(title, fields, onSave, saveText = '保存') {
  const d = $('#editDlg');
  $('#editTitle').textContent = title;
  $('#editBody').innerHTML = fields;
  $('#editErr').textContent = '';
  $('#editForm button[type=submit]').textContent = saveText;
  $('#editForm').onsubmit = async (e) => {
    e.preventDefault();
    $('#editErr').textContent = '';
    try { await onSave(new FormData(e.target), e.target); d.close(); } catch (x) { $('#editErr').textContent = x.message; }
  };
  d.showModal();
  const first = $('input:not([type=hidden]):not([type=checkbox]), textarea', $('#editBody'));
  if (first) first.focus();
}

const FWD_HINT = '外部邮箱要先在 Cloudflare 后台「电子邮件 → 电子邮件路由 → 目标地址」里添加并点验证邮件,转发才会成功。';

// ---------- 临时邮箱收件地址(设置页和临时邮箱页共用) ----------
// r: { catch_all, catch_all_fwd, locked } —— 就是兜底规则
function tempTargetPanel(r) {
  const custom = !!r.catch_all_fwd;
  const box = r.catch_all || state.me.address;
  return `<form class="panel" data-target>
    <div class="sec-head"><h2>临时邮箱收件地址 <span class="muted sm">任意前缀@${esc((state.me.domains || [])[0] || '')} 收到的信送到哪</span></h2></div>
    <div class="choice">
      <label class="radio-card"><input type="radio" name="mode" value="admin" ${custom ? '' : 'checked'}>
        <span><strong>管理员邮箱</strong><span class="muted sm">默认。信存进 ${esc(box)},登录这里查看</span></span></label>
      <label class="radio-card"><input type="radio" name="mode" value="custom" ${custom ? 'checked' : ''}>
        <span><strong>自定义邮箱</strong><span class="muted sm">送到你的 Gmail、QQ 邮箱等,在那边查看</span></span></label>
    </div>
    <div data-custom class="stack ${custom ? '' : 'hidden'}">
      <label>收件邮箱<input name="fwd" type="email" value="${esc(r.catch_all_fwd)}" placeholder="例如 you@gmail.com"></label>
      <label class="check"><input type="checkbox" name="keep" ${!custom || r.catch_all || r.locked ? 'checked' : ''} ${r.locked ? 'disabled' : ''}>
        管理员邮箱里也保留一份<span class="muted sm">(方便用临时地址回信${r.locked ? ';这一项写在部署配置里,改不了' : ''})</span></label>
      <div class="hint"><strong>第一次用要验证这个邮箱:</strong>Cloudflare 后台 → 你的域名 → 电子邮件 → 电子邮件路由 → 目标地址 → 添加地址,填上面的邮箱,然后去那个邮箱点验证链接。验证前信转不过去,失败会记在管理后台的记录里。</div>
    </div>
    <div class="actions"><button class="primary" type="submit">保存</button></div>
  </form>`;
}

function wireTempTarget(form, r, after) {
  const sync = () => $('[data-custom]', form).classList.toggle('hidden', form.mode.value !== 'custom');
  $$('[name=mode]', form).forEach((x) => (x.onchange = sync));
  form.onsubmit = async (e) => {
    e.preventDefault();
    const box = r.catch_all || state.me.address;
    let j;
    if (form.mode.value === 'admin') j = { catch_all: box, catch_all_fwd: '' };
    else {
      const fwd = form.fwd.value.trim();
      if (!fwd) { toast('请填收件邮箱'); form.fwd.focus(); return; }
      j = { catch_all_fwd: fwd, catch_all: form.keep.checked ? box : '' };
    }
    if (r.locked) delete j.catch_all;
    try { await api('/admin/routing', { method: 'POST', json: j }); toast('已保存,最多 30 秒后生效'); if (after) await after(); } catch (x) { toast(x.message); }
  };
}

// ---------- 临时邮箱 ----------
// 默认规则(=兜底规则)当前送到哪,用来显示自动地址的去向
let tempDefaults = null;
function defaultChips() {
  const d = tempDefaults;
  if (!d) return `<span class="chip">跟随默认规则</span>`;
  const parts = [];
  if (d.box) parts.push(`<span class="chip">${icon('inbox', 'sm')}${d.box === state.me.address ? '我的邮箱' : esc(d.box)}</span>`);
  if (d.fwd) parts.push(`<span class="chip">${icon('forward', 'sm')}${esc(d.fwd)}</span>`);
  return parts.join('') || '<span class="chip">退回</span>';
}

function TEMP_DEST_TEXT() {
  if (!state.me.is_admin) return '临时地址收到的信进你的邮箱;要转发到外部邮箱,请联系管理员。';
  const d = tempDefaults || {};
  const parts = [];
  if (d.box) parts.push(d.box === state.me.address ? '存进管理员邮箱' : `存进 ${esc(d.box)}`);
  if (d.fwd) parts.push(`转发到 ${esc(d.fwd)}`);
  return `收到的信现在会${parts.join(',同时') || '被退回'}。这是全局设置,在「设置 → 临时邮箱收件地址」统一修改。`;
}
const TEMP_DEST_NOTE = () => `<p class="hint">${TEMP_DEST_TEXT()}</p>`;

function tempRows(items, showOwner, reload) {
  if (!items.length) return `<div class="empty small">${icon('shuffle')}<p>还没有临时地址。随便写一个前缀去注册网站,收到第一封信后它就会出现在这里</p></div>`;
  const now = Date.now();
  const rows = items.map((a) => {
    const expired = a.expires_at && a.expires_at < now;
    const st = !a.enabled ? badge('neutral', '已停用') : expired ? badge('warn', '已过期') : badge('ok', '使用中');
    const to = a.auto ? defaultChips() : `<span class="chip">${icon('inbox', 'sm')}${a.owner === state.me.address ? '我的邮箱' : esc(a.owner || '')}</span>`;
    const exp = a.expires_at ? (expired ? '已过期' : `${fmtDay(a.expires_at)} 到期`) : '永久';
    return `<tr data-q="${esc((a.address + ' ' + a.note + ' ' + a.fwd_to).toLowerCase())}">
      <td><div class="addr-cell"><code>${esc(a.address)}</code><button class="icon-btn xs" data-copy="${esc(a.address)}" title="复制">${icon('copy')}</button></div>${a.note ? `<div class="muted sm">${esc(a.note)}</div>` : ''}</td>
      ${showOwner ? `<td>${esc(a.owner || '—')}</td>` : ''}
      <td><div class="chips">${to}</div>${a.auto ? '<div class="muted sm">按全局设置</div>' : ''}</td>
      <td>${st}<div class="muted sm">${exp}</div></td>
      <td class="num">${a.hits}<div class="muted sm">${a.last_at ? '最近 ' + fmtDate(a.last_at) : '还没收到'}</div></td>
      <td class="acts">
        <button class="icon-btn" data-view="${esc(a.address)}" data-owner="${esc(a.owner || '')}" title="查看收到的信">${icon('inbox')}</button>
        <button class="icon-btn" data-tedit="${esc(a.address)}" title="设置">${icon('edit')}</button>
        <button class="icon-btn" data-ttoggle="${esc(a.address)}" data-on="${a.enabled}" title="${a.enabled ? '停用(之后发来的信会被退回)' : '启用'}">${icon('power')}</button>
        <button class="icon-btn danger" data-tdel="${esc(a.address)}" title="删除">${icon('trash')}</button>
      </td></tr>`;
  }).join('');
  setTimeout(() => wireTemp(items, reload));
  return `<div class="table-wrap"><table class="tbl"><thead><tr><th>地址</th>${showOwner ? '<th>所属账号</th>' : ''}<th>送到</th><th>状态</th><th class="num">收到</th><th></th></tr></thead><tbody class="temp-rows">${rows}</tbody></table></div>`;
}

function wireTemp(items, reload) {
  $$('[data-copy]', page).forEach((b) => (b.onclick = () => copyText(b.dataset.copy)));
  $$('[data-view]', page).forEach((b) => (b.onclick = () => {
    closePage();
    state.folder = 'inbox'; state.rcpt = b.dataset.view; state.q = ''; $('#search').value = '';
    if (state.me.is_admin && b.dataset.owner && b.dataset.owner !== state.me.address) { state.box = b.dataset.owner; $('#boxSel').value = state.box; }
    else state.box = state.me.address;
    location.hash = 'inbox'; closeReader(); loadList();
  }));
  $$('[data-ttoggle]', page).forEach((b) => (b.onclick = async () => {
    try { await api(`/temp/${encodeURIComponent(b.dataset.ttoggle)}`, { method: 'PATCH', json: { enabled: b.dataset.on !== '1' } }); reload(); } catch (x) { toast(x.message); }
  }));
  $$('[data-tdel]', page).forEach((b) => (b.onclick = async () => {
    if (!confirm(`删除 ${b.dataset.tdel}?之后再有信发到这个地址,它会按默认规则重新出现。想让它收不到信请用「停用」。已收到的信不会删。`)) return;
    try { await api(`/temp/${encodeURIComponent(b.dataset.tdel)}`, { method: 'DELETE' }); reload(); } catch (x) { toast(x.message); }
  }));
  $$('[data-tedit]', page).forEach((b) => (b.onclick = () => {
    const a = items.find((x) => x.address === b.dataset.tedit);
    editDialog(`编辑 ${a.address}`, `
      <label>备注<input name="note" value="${esc(a.note)}" placeholder="例如:哪个网站用的"></label>
      <label>有效期<select name="days"><option value="keep">不改(${a.expires_at ? fmtDay(a.expires_at) + ' 到期' : '永久'})</option><option value="0">改成永久</option><option value="1">从现在起 1 天</option><option value="7">从现在起 7 天</option><option value="30">从现在起 30 天</option></select></label>
      ${TEMP_DEST_NOTE()}`, async (f) => {
      const j = { note: f.get('note') };
      if (f.get('days') !== 'keep') j.days = Number(f.get('days'));
      await api(`/temp/${encodeURIComponent(a.address)}`, { method: 'PATCH', json: j });
      toast('已保存'); reload();
    });
  }));
}

function newTempDialog(domain) {
  editDialog('新建临时地址', `
    <p class="muted sm" style="margin:0">不建也能用:随便写一个前缀就能收信。只有想提前写好备注或设有效期时才需要在这里建。</p>
    <label>地址
      <div class="addr-input"><input name="local" placeholder="留空就随机生成" autocomplete="off" autocapitalize="off" spellcheck="false"><span class="suffix">@${esc(domain)}</span>
      <button type="button" class="icon-btn" data-rand title="随机生成一个">${icon('dice')}</button></div></label>
    <div class="form-grid">
      <label>备注<input name="note" placeholder="例如:某购物网站" maxlength="100"></label>
      <label>有效期<select name="days"><option value="0">永久</option><option value="1">1 天</option><option value="7">7 天</option><option value="30">30 天</option><option value="90">90 天</option></select></label>
    </div>
    ${TEMP_DEST_NOTE()}`, async (f) => {
    const r = await api('/temp', { method: 'POST', json: { local: f.get('local'), note: f.get('note'), days: Number(f.get('days')) } });
    state.me = await api('/me');
    await pageTemp();
    copyText(r.address);
  }, '创建');
  $('#editBody [data-rand]').onclick = () => {
    const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
    $('#editForm').local.value = [...crypto.getRandomValues(new Uint8Array(10))].map((n) => abc[n % abc.length]).join('');
  };
}

async function pageTemp() {
  const all = state.me.is_admin && state.tempAll;
  const { items, domain, defaults } = await api('/temp' + (all ? '?all=1' : ''));
  tempDefaults = defaults || null;
  const d = defaults;
  page.innerHTML = `${head('临时邮箱', `随便写一个前缀 <code>任意名字@${esc(domain)}</code> 就能收信,不用提前建。收到第一封信后,地址会自动出现在下面。`,
)}
  <div class="page-body">
    <div class="dest-note">${icon('route')}<span>${TEMP_DEST_TEXT()}</span>${state.me.is_admin ? '<a data-go-settings>去设置修改</a>' : ''}</div>
    <section class="panel">
      <div class="sec-head"><h2>${all ? '所有人的临时地址' : '我的临时地址'} <span class="count">${items.length}</span></h2>
        <div class="tools">
          <div class="search sm-search">${icon('search')}<input id="tempQ" type="search" placeholder="搜索地址或备注"></div>
          <button class="primary" id="newTemp">${icon('plus')}新建临时地址</button>
          ${state.me.is_admin ? `<label class="check sm"><input type="checkbox" id="tempAll" ${all ? 'checked' : ''}> 所有人的</label>` : ''}
        </div></div>
      ${tempRows(items, all, pageTemp)}
    </section>
  </div>`;
  wire();
  $('#newTemp').onclick = () => newTempDialog(domain);
  if ($('#tempAll')) $('#tempAll').onchange = (e) => { state.tempAll = e.target.checked; pageTemp(); };
  $('#tempQ').oninput = (e) => { const q = e.target.value.trim().toLowerCase(); $$('.temp-rows tr', page).forEach((tr) => (tr.style.display = !q || tr.dataset.q.includes(q) ? '' : 'none')); };
  if ($('[data-go-settings]', page)) $('[data-go-settings]', page).onclick = () => openPage('settings');
}

// ---------- 在 Foxmail / Outlook 里使用 ----------
// Cloudflare Workers 开不了 IMAP/POP3 服务,所以客户端收信靠「转发到外部邮箱」,发信走 Resend 的 SMTP
function clientPanel() {
  const me = state.me;
  const row = (k, v, copy = true) => `<tr><td class="muted nowrap">${k}</td><td><div class="addr-cell"><code>${esc(v)}</code>${copy ? `<button class="icon-btn xs" type="button" data-copy="${esc(v)}" title="复制">${icon('copy')}</button>` : ''}</div></td></tr>`;
  const pass = me.is_admin
    ? `在 Resend 后台 API Keys 里新建一个 Key 当密码。建议每个人、每台设备单独建一个,权限选 Sending access、域名只选 <code>${esc((me.domains || [])[0] || '')}</code>,丢了可以单独删掉`
    : '找管理员要一个 Resend API Key 当密码(re_ 开头)';
  return `<section class="panel">
    <h2>在 Foxmail / Outlook 里使用 <span class="muted sm">用电脑、手机上的邮件客户端收发这个邮箱</span></h2>
    <p class="hint">这个邮箱跑在 Cloudflare 上,没有 IMAP/POP3 收信服务,客户端不能直接登录。办法是:<strong>收信</strong>转发到 QQ、Gmail 等外部邮箱,在客户端里添加那个邮箱;<strong>发信</strong>在客户端里加一个 SMTP 发件服务器,用 ${esc(me.address)} 的身份发出去。</p>
    <h3>第 1 步 · 收信</h3>
    <ol class="steps">
      <li>在上面「转发到外部邮箱」填你的 QQ 邮箱或 Gmail${me.fwd_to ? `(现在转发到 <code>${esc(me.fwd_to)}</code>)` : ''}。想网页版里也留一份,就勾上「转发后在这里也保留一份」。</li>
      <li>在 Foxmail / Outlook 里按平常的方法添加那个 QQ 或 Gmail 账号,发到 ${esc(me.address)} 的信就会出现在里面。</li>
    </ol>
    <h3>第 2 步 · 用 ${esc(me.address)} 发信</h3>
    ${me.can_send ? '' : `<p class="hint">系统还没开通发信${me.is_admin ? `,先去 <a data-goto-send>管理后台 → 发信</a> 填 Resend Key` : ',请联系管理员'}。</p>`}
    <div class="table-wrap"><table class="tbl mini"><tbody>
      ${row('发件服务器(SMTP)', 'smtp.resend.com')}
      ${row('端口', '465')}
      ${row('加密方式', 'SSL/TLS', false)}
      ${row('用户名', 'resend')}
      <tr><td class="muted nowrap">密码</td><td class="sm">${pass}</td></tr>
      ${row('发件人地址', me.address)}
    </tbody></table></div>
    <ol class="steps">
      <li><strong>Foxmail</strong>:在收 QQ/Gmail 的那个账号里,设置 → 账号 → 发件人身份(或「其他邮箱」)新增 ${esc(me.address)},发件服务器填上面的参数。写信时在「发件人」里选它。</li>
      <li><strong>Outlook</strong>:文件 → 账户设置 → 新建,选「手动设置 → POP 或 IMAP」,电子邮件填 ${esc(me.address)},接收服务器可以填 QQ/Gmail 的,发送服务器填上面的参数。</li>
      <li>465 端口连不上时,换 587,加密方式选 STARTTLS。</li>
    </ol>
    <p class="hint">注意:从客户端发出的信不经过这个网页,所以不会出现在这里的「已发送」里,也不计入每天的发信上限。</p>
  </section>`;
}

// ---------- 个人设置 ----------
async function pageSettings() {
  const s = await api('/settings');
  const route = state.me.is_admin ? await api('/admin/routing') : null;
  const pct = s.quota_mb ? Math.min(100, (s.used / (s.quota_mb * 1048576)) * 100) : 0;
  page.innerHTML = `${head('设置', esc(state.me.address))}
  <div class="page-body narrow">
    <section class="panel">
      <h2>用量</h2>
      <div class="usage">
        <div><div class="muted sm">存储</div><div class="big">${fmtSize(s.used)}<span class="muted"> / ${s.quota_mb ? s.quota_mb + ' MB' : '不限'}</span></div>
          ${s.quota_mb ? `<div class="meter"><span style="width:${pct}%"></span></div>` : ''}</div>
        <div><div class="muted sm">最近 24 小时发信</div><div class="big">${s.sent_24h}<span class="muted"> / ${s.send_limit ? s.send_limit + ' 封' : '不限'}</span></div></div>
      </div>
    </section>
    ${route ? tempTargetPanel(route) : ''}
    <form class="panel" data-sec>
      <h2>个人资料</h2>
      <label>显示名称<span class="muted sm">发信时对方看到的名字</span><input name="name" value="${esc(s.name)}" maxlength="80"></label>
      <label>签名<span class="muted sm">写信、回复时自动加在正文后面</span><textarea name="signature" rows="4">${esc(s.signature)}</textarea></label>
      <div class="actions"><button class="primary" type="submit">保存</button></div>
    </form>
    <form class="panel" data-sec>
      <h2>自动回复</h2>
      <label class="switch"><input type="checkbox" name="ar_on" ${s.ar_on ? 'checked' : ''}><span class="track"></span>开启自动回复<span class="muted sm">同一个人 4 天内只回一次;群发、通知类邮件不回</span></label>
      <label>主题<input name="ar_subject" value="${esc(s.ar_subject)}" placeholder="留空就用「自动回复:原主题」"></label>
      <label>内容<textarea name="ar_body" rows="4" placeholder="你好,我这几天休假,回来后会尽快回复你。">${esc(s.ar_body)}</textarea></label>
      <label>截止日期<span class="muted sm">到这天结束后自动关闭,留空表示一直开着</span><input name="ar_until" type="date" value="${s.ar_until ? fmtDay(s.ar_until - 1) : ''}"></label>
      <div class="actions"><button class="primary" type="submit">保存</button></div>
    </form>
    <form class="panel" data-sec>
      <h2>转发到外部邮箱</h2>
      <label>转发地址<span class="muted sm">发给 ${esc(state.me.address)} 的信同时转发到这里,留空表示不转发</span><input name="fwd_to" type="email" value="${esc(s.fwd_to)}" placeholder="例如 you@gmail.com"></label>
      <label class="check"><input type="checkbox" name="fwd_keep" ${s.fwd_keep ? 'checked' : ''}> 转发后在这里也保留一份</label>
      <p class="hint">${FWD_HINT}</p>
      <div class="actions"><button class="primary" type="submit">保存</button></div>
    </form>
    ${clientPanel()}
    <form class="panel" id="pwForm2">
      <h2>修改密码</h2>
      <label>原密码<input name="old" type="password" autocomplete="current-password" required></label>
      <label>新密码<span class="muted sm">至少 10 位</span><input name="password" type="password" autocomplete="new-password" minlength="10" required></label>
      <div class="actions"><span class="error" id="pwErr"></span><button class="primary" type="submit">修改密码</button></div>
    </form>
  </div>`;
  wire();
  $$('[data-copy]', page).forEach((b) => (b.onclick = () => copyText(b.dataset.copy)));
  if ($('[data-goto-send]', page)) $('[data-goto-send]', page).onclick = () => openPage('admin/send');
  if (route) wireTempTarget($('[data-target]', page), route, pageSettings);
  $$('form[data-sec]', page).forEach((form) => (form.onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(form), j = {};
    for (const el of form.elements) {
      if (!el.name) continue;
      if (el.type === 'checkbox') j[el.name] = el.checked;
      else if (el.name === 'ar_until') j.ar_until = el.value ? new Date(el.value + 'T00:00:00').getTime() + DAY_MS : 0;
      else j[el.name] = f.get(el.name);
    }
    try { await api('/settings', { method: 'POST', json: j }); state.me = await api('/me'); toast('已保存'); } catch (x) { toast(x.message); }
  }));
  $('#pwForm2').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    $('#pwErr').textContent = '';
    try { await api('/password', { method: 'POST', json: { old: f.get('old'), password: f.get('password') } }); e.target.reset(); toast('密码已修改,其他设备需要重新登录'); }
    catch (x) { $('#pwErr').textContent = x.message; }
  };
}

// ---------- 管理后台 ----------
const ADMIN_TABS = [
  ['overview', '概览', 'chart'], ['users', '账号', 'users'], ['addresses', '别名和群组', 'at'],
  ['temps', '临时地址', 'shuffle'], ['brand', '品牌', 'image'], ['send', '发信', 'send'], ['logs', '记录', 'list'],
];

async function pageAdmin(tab = 'overview') {
  if (!state.me.is_admin) return;
  if (!ADMIN_TABS.some((t) => t[0] === tab)) tab = 'overview';
  page.innerHTML = `${head('管理后台', esc((state.me.domains || []).join(', ')))}
    <div class="tabs" role="tablist">${ADMIN_TABS.map(([k, t, ic]) => `<a data-tab="${k}" class="${k === tab ? 'on' : ''}">${icon(ic, 'sm')}${t}</a>`).join('')}</div>
    <div class="page-body" id="tabBody"><div class="empty small"><p>加载中…</p></div></div>`;
  wire();
  $$('[data-tab]', page).forEach((a) => (a.onclick = () => openPage('admin/' + a.dataset.tab)));
  await ADMIN[tab]($('#tabBody'));
}

const LOG_KINDS = {
  login: ['ok', '登录成功'], login_fail: ['bad', '登录失败'], deliver: ['ok', '已投递'], reject: ['neutral', '已退回'],
  forward: ['ok', '已转发'], forward_fail: ['bad', '转发失败'], quota: ['warn', '邮箱已满'], autoreply: ['ok', '自动回复'],
  autoreply_fail: ['bad', '自动回复失败'], send: ['ok', '已发送'], send_fail: ['bad', '发送失败'],
};

const ADMIN = {
  async overview(el) {
    const o = await api('/admin/overview');
    const days = Array.from({ length: 14 }, (_, i) => { const d = 13 - i; const r = o.days.find((x) => x.d === d) || {}; return { d, recv: r.recv || 0, sent: r.sent || 0 }; });
    const max = Math.max(1, ...days.map((x) => x.recv));
    const label = (d) => { const t = new Date(Date.now() - d * DAY_MS); return `${t.getMonth() + 1}/${t.getDate()}`; };
    const tile = (k, v, sub = '') => `<div class="tile"><div class="muted sm">${k}</div><div class="tile-v">${v}</div>${sub ? `<div class="muted sm">${sub}</div>` : ''}</div>`;
    const alerts = [];
    if (!o.can_send) alerts.push(`<div class="alert">${icon('send')}<span>还没开通发信,账号只能收信。</span><a data-goto="send">去设置</a></div>`);
    if (o.fwd_fail_7d) alerts.push(`<div class="alert bad">${icon('forward')}<span>最近 7 天有 ${o.fwd_fail_7d} 次转发失败,多半是外部邮箱还没在 Cloudflare 验证。</span><a data-goto="logs">看记录</a></div>`);
    el.innerHTML = `${alerts.join('')}
      <div class="tiles">
        ${tile('账号', o.users, o.disabled ? `${o.disabled} 个已停用` : '全部正常')}
        ${tile('24 小时收信', o.recv_24h)}
        ${tile('24 小时发信', o.sent_24h)}
        ${tile('存储', fmtSize(o.storage), `${o.messages} 封信`)}
        ${tile('临时地址', o.temps, `别名和群组 ${o.aliases} 个`)}
        ${tile('7 天退信', o.rejects_7d)}
      </div>
      <div class="two">
        <section class="panel">
          <h2>最近 14 天收信</h2>
          <div class="bars" role="img" aria-label="最近 14 天每天收信数量">
            ${days.map((x) => `<div class="bar-col" tabindex="0"><div class="bar" style="height:${(x.recv / max) * 100}%"></div><div class="tip">${label(x.d)}<br>收信 ${x.recv} · 发信 ${x.sent}</div></div>`).join('')}
          </div>
          <div class="bar-axis"><span>${label(13)}</span><span>${label(7)}</span><span>今天</span></div>
          <details class="sm"><summary class="muted">查看数据</summary><table class="tbl mini"><thead><tr><th>日期</th><th class="num">收信</th><th class="num">发信</th></tr></thead><tbody>${days.slice().reverse().map((x) => `<tr><td>${label(x.d)}</td><td class="num">${x.recv}</td><td class="num">${x.sent}</td></tr>`).join('')}</tbody></table></details>
        </section>
        <section class="panel">
          <h2>收信最多的地址 <span class="muted sm">最近 30 天</span></h2>
          ${o.top.length ? `<ol class="rank">${o.top.map((t) => `<li><code>${esc(t.address)}</code><span class="num">${t.n}</span></li>`).join('')}</ol>` : '<p class="muted">还没有信</p>'}
        </section>
      </div>`;
    $$('[data-goto]', el).forEach((a) => (a.onclick = () => openPage('admin/' + a.dataset.goto)));
  },

  async users(el) {
    const { items, domains } = await api('/admin/users');
    const domain = domains[0] || '';
    el.innerHTML = `<section class="panel">
      <div class="sec-head"><h2>账号 <span class="count">${items.length}</span></h2>
        <div class="tools"><div class="search sm-search">${icon('search')}<input id="userQ" type="search" placeholder="搜索账号"></div>
        <button id="batchUsers">批量创建</button><button class="primary" id="newUser">${icon('plus')}新建账号</button></div></div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>账号</th><th>状态</th><th>用量</th><th>最近登录</th><th></th></tr></thead><tbody id="userRows">
      ${items.map((u) => `<tr data-q="${esc((u.address + ' ' + u.name + ' ' + (u.aliases || '')).toLowerCase())}">
        <td><div class="who-cell">${avatar(u.name, u.address)}<div><div><strong>${esc(u.name || u.address.split('@')[0])}</strong> ${u.is_admin ? badge('accent', '管理员') : ''}</div>
          <div class="muted sm">${esc(u.address)}${u.aliases ? ` · 别名 ${esc(u.aliases)}` : ''}</div></div></div></td>
        <td>${u.disabled ? badge('bad', '已停用') : badge('ok', '正常')}${u.fwd_to ? `<div class="muted sm">转发到 ${esc(u.fwd_to)}</div>` : ''}${u.ar_on ? '<div class="muted sm">自动回复中</div>' : ''}</td>
        <td>${fmtSize(u.used)}${u.quota_mb ? ` / ${u.quota_mb} MB` : ''}<div class="muted sm">${u.total} 封${u.send_limit ? ` · 每天最多发 ${u.send_limit} 封` : ''}</div></td>
        <td>${ago(u.last_login)}</td>
        <td class="acts">
          <button class="icon-btn" data-uedit="${u.id}" title="编辑">${icon('edit')}</button>
          <button class="icon-btn" data-upw="${u.id}" title="重设密码">${icon('key')}</button>
          <button class="icon-btn" data-uout="${u.id}" title="让它在所有设备退出登录">${icon('logout')}</button>
          ${u.address === state.me.address ? '' : `<button class="icon-btn danger" data-udel="${u.id}" title="删除">${icon('trash')}</button>`}
        </td></tr>`).join('')}</tbody></table></div></section>`;
    const reload = () => ADMIN.users(el);
    $('#userQ').oninput = (e) => { const q = e.target.value.trim().toLowerCase(); $$('#userRows tr').forEach((tr) => (tr.style.display = !q || tr.dataset.q.includes(q) ? '' : 'none')); };
    const userFields = (u = {}) => `
      ${u.id ? '' : `<label>地址<div class="addr-input"><input name="local" required autocomplete="off" autocapitalize="off" spellcheck="false"><span class="suffix">@${esc(domain)}</span></div></label>`}
      <label>显示名称<input name="name" value="${esc(u.name || '')}" maxlength="80"></label>
      ${u.id ? '' : '<label>密码<span class="muted sm">至少 10 位</span><input name="password" type="password" minlength="10" required autocomplete="new-password"></label>'}
      <div class="form-grid">
        <label>存储上限(MB)<span class="muted sm">0 表示不限</span><input name="quota_mb" type="number" min="0" value="${u.quota_mb || 0}"></label>
        <label>每天最多发信<span class="muted sm">0 表示不限</span><input name="send_limit" type="number" min="0" value="${u.send_limit || 0}"></label>
      </div>
      <label>转发到外部邮箱<span class="muted sm">这个账号收到的信同时转发到这里,留空表示不转发。外部邮箱要先在 Cloudflare「电子邮件路由 → 目标地址」验证</span><input name="fwd_to" type="email" value="${esc(u.fwd_to || '')}" placeholder="例如 someone@gmail.com"></label>
      <label class="check"><input type="checkbox" name="is_admin" ${u.is_admin ? 'checked' : ''}> 管理员</label>
      ${u.id ? `<label class="check"><input type="checkbox" name="disabled" ${u.disabled ? 'checked' : ''}> 停用这个账号(不能登录,发来的信会被退回)</label>` : ''}`;
    $('#newUser').onclick = () => editDialog('新建账号', userFields(), async (f) => {
      await api('/admin/users', { method: 'POST', json: {
        address: `${String(f.get('local')).trim().toLowerCase()}@${domain}`, name: f.get('name'), password: f.get('password'),
        is_admin: f.get('is_admin') === 'on', quota_mb: Number(f.get('quota_mb')), send_limit: Number(f.get('send_limit')), fwd_to: f.get('fwd_to'),
      } });
      toast('已创建'); reload();
    }, '创建');
    $$('[data-uedit]', el).forEach((b) => (b.onclick = () => {
      const u = items.find((x) => String(x.id) === b.dataset.uedit);
      editDialog(`编辑 ${u.address}`, userFields(u), async (f) => {
        await api(`/admin/users/${u.id}`, { method: 'PATCH', json: {
          name: f.get('name'), quota_mb: Number(f.get('quota_mb')), send_limit: Number(f.get('send_limit')), fwd_to: f.get('fwd_to'),
          is_admin: f.get('is_admin') === 'on', disabled: f.get('disabled') === 'on',
        } });
        toast('已保存'); reload();
      });
    }));
    $$('[data-upw]', el).forEach((b) => (b.onclick = () => {
      const u = items.find((x) => String(x.id) === b.dataset.upw);
      editDialog(`重设 ${u.address} 的密码`, `<label>新密码<span class="muted sm">至少 10 位。重设后这个账号在所有设备都要重新登录</span>
        <div class="addr-input"><input name="password" minlength="10" required autocomplete="new-password" value="${genPassword()}"><button type="button" class="icon-btn" data-gen title="换一个">${icon('dice')}</button></div></label>`, async (f) => {
        await api(`/admin/users/${u.id}/password`, { method: 'POST', json: { password: f.get('password') } });
        copyText(f.get('password')); toast('密码已重设,新密码已复制');
      }, '重设');
      $('[data-gen]').onclick = () => { $('#editForm').password.value = genPassword(); };
    }));
    $$('[data-uout]', el).forEach((b) => (b.onclick = async () => {
      if (!confirm('让这个账号在所有设备上退出登录?')) return;
      try { await api(`/admin/users/${b.dataset.uout}/logout`, { method: 'POST' }); toast(b.dataset.uout === String(state.me.id) ? '已退出' : '已让它退出登录'); } catch (x) { toast(x.message); }
    }));
    $$('[data-udel]', el).forEach((b) => (b.onclick = async () => {
      const u = items.find((x) => String(x.id) === b.dataset.udel);
      if (!confirm(`删除账号 ${u.address}?它的别名和临时地址也会删除。已收的信会保留,管理员仍能查看。`)) return;
      try { await api(`/admin/users/${u.id}`, { method: 'DELETE' }); toast('已删除'); reload(); } catch (x) { toast(x.message); }
    }));
    $('#batchUsers').onclick = () => batchDialog(domain, reload);
  },

  async addresses(el) {
    const [{ items }, { items: users }] = await Promise.all([api('/admin/addresses'), api('/admin/users')]);
    const domain = (state.me.domains || [])[0] || '';
    el.innerHTML = `<section class="panel">
      <div class="sec-head"><h2>别名和群组 <span class="count">${items.length}</span></h2><button class="primary" id="newAddr">${icon('plus')}新建</button></div>
      <p class="muted sm">别名:一个账号的另一个地址,比如 sales@ 的信进 alice 的邮箱,alice 也能用 sales@ 发信。群组:发给 team@ 的信送到每个成员,成员可以是本域名账号或外部邮箱。</p>
      ${items.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>地址</th><th>类型</th><th>送到</th><th class="num">收到</th><th>状态</th><th></th></tr></thead><tbody>
      ${items.map((a) => `<tr>
        <td><div class="addr-cell"><code>${esc(a.address)}</code><button class="icon-btn xs" data-copy="${esc(a.address)}" title="复制">${icon('copy')}</button></div>${a.note ? `<div class="muted sm">${esc(a.note)}</div>` : ''}</td>
        <td>${a.kind === 'group' ? badge('accent', '群组') : badge('neutral', '别名')}</td>
        <td><div class="chips">${(a.kind === 'group' ? a.members : [a.owner]).map((m) => `<span class="chip">${esc(m)}</span>`).join('')}</div></td>
        <td class="num">${a.hits}<div class="muted sm">${a.last_at ? fmtDate(a.last_at) : ''}</div></td>
        <td>${a.enabled ? badge('ok', '使用中') : badge('neutral', '已停用')}</td>
        <td class="acts">
          <button class="icon-btn" data-aedit="${esc(a.address)}" title="编辑">${icon('edit')}</button>
          <button class="icon-btn" data-atoggle="${esc(a.address)}" data-on="${a.enabled}" title="${a.enabled ? '停用' : '启用'}">${icon('power')}</button>
          <button class="icon-btn danger" data-adel="${esc(a.address)}" title="删除">${icon('trash')}</button>
        </td></tr>`).join('')}</tbody></table></div>` : `<div class="empty small">${icon('at')}<p>还没有别名或群组</p></div>`}
    </section>`;
    const reload = () => ADMIN.addresses(el);
    const userOpts = (sel) => users.map((u) => `<option value="${esc(u.address)}" ${u.address === sel ? 'selected' : ''}>${esc(u.address)}${u.name ? ' · ' + esc(u.name) : ''}</option>`).join('');
    $$('[data-copy]', el).forEach((b) => (b.onclick = () => copyText(b.dataset.copy)));
    $('#newAddr').onclick = () => {
      editDialog('新建别名或群组', `
        <div class="seg"><label><input type="radio" name="kind" value="alias" checked><span>别名</span></label><label><input type="radio" name="kind" value="group"><span>群组</span></label></div>
        <label>地址<div class="addr-input"><input name="local" required autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="例如 sales"><span class="suffix">@${esc(domain)}</span></div></label>
        <label data-k="alias">属于哪个账号<select name="owner">${userOpts()}</select></label>
        <label data-k="group" class="hidden">成员<span class="muted sm">每行一个,可以是本域名账号或外部邮箱(外部邮箱要先在 Cloudflare 验证)</span><textarea name="members" rows="4" placeholder="alice@${esc(domain)}&#10;bob@${esc(domain)}"></textarea></label>
        <label>备注<input name="note" maxlength="100"></label>`, async (f) => {
        const kind = f.get('kind');
        await api('/admin/addresses', { method: 'POST', json: { kind, local: f.get('local'), owner: f.get('owner'), members: f.get('members'), note: f.get('note') } });
        toast('已创建'); state.me = await api('/me'); reload();
      }, '创建');
      $$('#editBody [name=kind]').forEach((r) => (r.onchange = () => $$('#editBody [data-k]').forEach((x) => x.classList.toggle('hidden', x.dataset.k !== r.value))));
    };
    $$('[data-aedit]', el).forEach((b) => (b.onclick = () => {
      const a = items.find((x) => x.address === b.dataset.aedit);
      editDialog(`编辑 ${a.address}`, `${a.kind === 'group'
        ? `<label>成员<span class="muted sm">每行一个</span><textarea name="members" rows="5">${esc(a.members.join('\n'))}</textarea></label>`
        : `<label>属于哪个账号<select name="owner">${userOpts(a.owner)}</select></label>`}
        <label>备注<input name="note" value="${esc(a.note)}" maxlength="100"></label>`, async (f) => {
        const j = { note: f.get('note') };
        if (a.kind === 'group') j.members = f.get('members'); else j.owner = f.get('owner');
        await api(`/admin/addresses/${encodeURIComponent(a.address)}`, { method: 'PATCH', json: j });
        toast('已保存'); reload();
      });
    }));
    $$('[data-atoggle]', el).forEach((b) => (b.onclick = async () => {
      try { await api(`/admin/addresses/${encodeURIComponent(b.dataset.atoggle)}`, { method: 'PATCH', json: { enabled: b.dataset.on !== '1' } }); reload(); } catch (x) { toast(x.message); }
    }));
    $$('[data-adel]', el).forEach((b) => (b.onclick = async () => {
      if (!confirm(`删除 ${b.dataset.adel}?`)) return;
      try { await api(`/admin/addresses/${encodeURIComponent(b.dataset.adel)}`, { method: 'DELETE' }); reload(); } catch (x) { toast(x.message); }
    }));
  },

  async temps(el) {
    const { items } = await api('/temp?all=1');
    el.innerHTML = `<section class="panel"><div class="sec-head"><h2>所有人的临时地址 <span class="count">${items.length}</span></h2></div>${tempRows(items, true, () => ADMIN.temps(el))}</section>`;
  },

  async brand(el) {
    const b = await api('/brand');
    el.innerHTML = `<div class="narrow-col">
      <form class="panel" id="brandName">
        <h2>系统名称</h2>
        <label>名称<span class="muted sm">显示在左上角、登录页和浏览器标签上,比如公司名「某某科技邮箱」</span>
          <input name="name" value="${esc(b.name)}" maxlength="40" placeholder="OneMail"></label>
        <div class="actions"><button class="primary" type="submit">保存</button></div>
      </form>
      <section class="panel">
        <h2>Logo</h2>
        <div class="logo-edit">
          <span class="logo logo-lg ${b.logo ? 'has-img' : ''}">${b.logo ? `<img src="${esc(b.logo)}" alt="">` : DEFAULT_LOGO}</span>
          <div class="stack">
            <p class="muted sm" style="margin:0">建议用正方形图片,256×256 像素左右,PNG 或 SVG,不超过 512KB。透明背景效果最好。</p>
            <div class="tools">
              <label class="file-btn bordered">${icon('upload')}上传图片<input type="file" id="logoFile" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden></label>
              ${b.logo ? '<button type="button" id="logoDel">恢复默认</button>' : ''}
            </div>
          </div>
        </div>
      </section>
    </div>`;
    const refresh = async () => { applyBrand(await api('/brand')); await ADMIN.brand(el); };
    $('#brandName').onsubmit = async (e) => {
      e.preventDefault();
      try { await api('/admin/brand', { method: 'POST', json: { name: e.target.name.value.trim() } }); toast('已保存'); await refresh(); } catch (x) { toast(x.message); }
    };
    $('#logoFile').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const fd = new FormData(); fd.append('logo', f);
      try {
        const r = await fetch('/api/admin/brand/logo', { method: 'POST', body: fd, headers: { 'X-Mail': '1' } });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || '上传失败');
        toast('Logo 已更新'); await refresh();
      } catch (x) { toast(x.message); }
    };
    if ($('#logoDel')) $('#logoDel').onclick = async () => {
      try { await api('/admin/brand/logo', { method: 'DELETE' }); toast('已恢复默认 Logo'); await refresh(); } catch (x) { toast(x.message); }
    };
  },

  async send(el) {
    const r = await api('/admin/send');
    const status = {
      secret: [badge('ok', '已开通'), `用的是 Worker 机密里的 Key(…${esc(r.tail)}),这里改不了`],
      settings: [badge('ok', '已开通'), `Resend Key 结尾 …${esc(r.tail)}`],
      cloudflare: [badge('warn', 'Cloudflare 发信'), '需要 Workers 付费版。填了 Resend Key 会改用 Resend'],
    }[r.source] || [badge('neutral', '未开通'), '填一个 Resend API Key 就能发信'];
    el.innerHTML = `<div class="narrow-col"><section class="panel">
      <h2>发信(Resend)</h2>
      <p class="status-line">${status[0]}<span class="muted">${status[1]}</span></p>
      <form id="resendForm2" class="inline-form ${r.source === 'secret' ? 'hidden' : ''}">
        <input name="key" type="password" placeholder="re_ 开头的 API Key" autocomplete="off">
        <button class="primary" type="submit">保存</button>
        ${r.source === 'settings' ? '<button type="button" id="resendClear2">清除</button>' : ''}
      </form>
      <ol class="steps">
        <li>到 <a href="https://resend.com" target="_blank" rel="noopener">resend.com</a> 免费注册,在 Domains 里添加 <code>${esc((state.me.domains || [])[0] || '')}</code>,选自动配置 Cloudflare,等状态变成 Verified。</li>
        <li>在 API Keys 里创建一个 Key(Sending access 就够),复制下来粘到上面。</li>
        <li>免费额度每天 100 封、每月 3000 封,所有账号共用。可以在「账号」里给每个人设每天上限。</li>
      </ol>
    </section></div>`;
    const save = async (key) => {
      try { const x = await api('/admin/send', { method: 'POST', json: { key } }); toast(x.note); state.me = await api('/me'); ADMIN.send(el); } catch (x) { toast(x.message); }
    };
    $('#resendForm2').onsubmit = (e) => { e.preventDefault(); const k = e.target.key.value.trim(); if (k) save(k); };
    if ($('#resendClear2')) $('#resendClear2').onclick = () => { if (confirm('清除后就不能发信了,确定吗?')) save(''); };
  },

  async logs(el, type = 'mail', q = '') {
    const { items } = await api(`/admin/logs?type=${type}&q=${encodeURIComponent(q)}`);
    const cols = type === 'login' ? ['时间', '结果', '账号', 'IP', '详情'] : ['时间', '结果', type === 'send' ? '发件人' : '发件人', type === 'send' ? '收件人' : '收件地址', '详情'];
    el.innerHTML = `<section class="panel">
      <div class="sec-head"><div class="seg">${[['mail', '收信'], ['send', '发信'], ['login', '登录']].map(([k, t]) => `<label><input type="radio" name="lt" value="${k}" ${k === type ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div>
        <div class="search sm-search">${icon('search')}<input id="logQ" type="search" placeholder="按地址搜索" value="${esc(q)}"></div></div>
      ${items.length ? `<div class="table-wrap"><table class="tbl"><thead><tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>
      ${items.map((x) => { const k = LOG_KINDS[x.kind] || ['neutral', x.kind]; return `<tr>
        <td class="nowrap">${fmtDate(x.at, true)}</td><td>${badge(k[0], k[1])}</td><td>${esc(x.actor)}</td>
        <td>${esc(type === 'login' ? x.ip : x.target)}</td><td class="detail">${esc(x.detail)}</td></tr>`; }).join('')}
      </tbody></table></div>` : `<div class="empty small">${icon('list')}<p>没有记录</p></div>`}
      <p class="muted sm">记录保留 90 天,最多显示最近 200 条。</p></section>`;
    $$('[name=lt]', el).forEach((r) => (r.onchange = () => ADMIN.logs(el, r.value, $('#logQ').value)));
    let t; $('#logQ').oninput = (e) => { clearTimeout(t); t = setTimeout(() => ADMIN.logs(el, type, e.target.value.trim()), 400); };
  },
};

// ---------- 批量创建账号 ----------
function genPassword() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  return [...crypto.getRandomValues(new Uint32Array(14))].map((n) => abc[n % abc.length]).join('');
}
function batchDialog(domain, reload) {
  let results = [];
  editDialog('批量创建账号', `
    <label>每行一个账号<span class="muted sm">格式:用户名[,密码][,显示名称]。不写密码会自动生成</span>
    <textarea name="lines" rows="7" placeholder="alice&#10;bob,MyPassword123,Bob Li&#10;carol,,Carol"></textarea></label>
    <p class="muted sm" id="batchMsg"></p>
    <div class="table-wrap hidden" id="batchWrap"><table class="tbl mini"><thead><tr><th>地址</th><th>密码</th><th>结果</th></tr></thead><tbody id="batchRows"></tbody></table></div>
    <button type="button" class="hidden" id="batchCsv">下载结果 CSV</button>`, async (f, form) => {
    const rows = String(f.get('lines')).split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const [u, pw, ...name] = l.split(/[,，\t]/).map((x) => x.trim());
      return { address: `${u.toLowerCase().replace(/@.*$/, '')}@${domain}`, password: pw || genPassword(), name: name.join(' ') };
    });
    if (!rows.length) throw new Error('请至少写一行');
    if (rows.length > 500) throw new Error('一次最多 500 个');
    $('#batchWrap').classList.remove('hidden'); $('#batchRows').innerHTML = ''; results = [];
    let ok = 0;
    for (const [i, r] of rows.entries()) {
      $('#batchMsg').textContent = `正在创建 ${i + 1}/${rows.length}…`;
      if (r.password.length < 10) r.result = '密码不到 10 位';
      else { try { await api('/admin/users', { method: 'POST', json: r }); r.result = '成功'; ok++; } catch (x) { r.result = x.message; } }
      results.push(r);
      $('#batchRows').insertAdjacentHTML('beforeend', `<tr><td>${esc(r.address)}</td><td><code>${r.result === '成功' ? esc(r.password) : ''}</code></td><td>${esc(r.result)}</td></tr>`);
    }
    $('#batchMsg').textContent = `完成:成功 ${ok} 个,失败 ${rows.length - ok} 个。密码只显示这一次,请下载保存。`;
    $('#batchCsv').classList.toggle('hidden', !ok);
    form.lines.value = '';
    reload();
    throw new Error(''); // 保持弹窗打开,方便下载结果
  }, '开始创建');
  $('#batchCsv').onclick = () => {
    const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = '﻿地址,密码,显示名称,结果\n' + results.map((r) => [r.address, r.result === '成功' ? r.password : '', r.name, r.result].map(q).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `mail-accounts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
}

const PAGES = { temp: pageTemp, settings: pageSettings, admin: pageAdmin };
window.addEventListener('hashchange', () => {
  const h = location.hash.slice(1);
  if (state.me && (h === 'temp' || h === 'settings' || h.startsWith('admin'))) openPage(h);
});

fillIcons();
api('/brand').then(applyBrand).catch(() => {}).finally(boot);
