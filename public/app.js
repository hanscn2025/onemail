'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// 线条图标(24x24，描边)
const ICONS = {
  bell: '<path d="M10.27 21a2 2 0 0 0 3.46 0"/><path d="M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.41 5.96-2.74 7.33"/>',
  compose: '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.4 2.6a2 2 0 0 1 3 3l-9 9a2 2 0 0 1-.86.5l-2.87.84a.5.5 0 0 1-.62-.62l.84-2.87a2 2 0 0 1 .5-.86Z"/>',
  filepen: '<path d="M12.5 22H18a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v9.5"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M13.38 15.63a1 1 0 1 0-3-3l-5.02 5.01a2 2 0 0 0-.5.86l-.84 2.87a.5.5 0 0 0 .62.62l2.87-.84a2 2 0 0 0 .86-.5Z"/>',
  mailclock: '<path d="M22 10.5V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/><circle cx="18" cy="18" r="4"/><path d="M18 16.5V18l1 1"/>',
  admin: '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4M10 10h4M10 14h4M10 18h4"/>',
  user: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.66V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.66"/>',
  autoreply: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/><path d="m10 7-3 3 3 3"/><path d="M17 13v-1a2 2 0 0 0-2-2H7"/>',
  devices: '<path d="M18 8V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h8"/><path d="M10 19v-4M7 19h5"/><rect width="6" height="10" x="16" y="12" rx="2"/>',
  imageoff: '<path d="M2 2l20 20"/><path d="M10.41 10.41a2 2 0 1 1-2.83-2.83"/><path d="M13.5 13.5 6 21"/><path d="m18 12 3 3"/><path d="M3.59 3.59A2 2 0 0 0 3 5v14a2 2 0 0 0 2 2h14a2 2 0 0 0 1.41-.59"/><path d="M21 15V5a2 2 0 0 0-2-2H9"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  palette: '<circle cx="13.5" cy="6.5" r="1" fill="currentColor"/><circle cx="17.5" cy="10.5" r="1" fill="currentColor"/><circle cx="8.5" cy="7.5" r="1" fill="currentColor"/><circle cx="6.5" cy="12.5" r="1" fill="currentColor"/><path d="M12 2a10 10 0 0 0 0 20c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.12a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.56-2.5 5.56-5.55C22 6.01 17.5 2 12 2Z"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
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

// 头像：取名字第一个字，颜色按地址固定
const AV_COLORS = ['#0f6cbd', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#2563eb', '#0d9488', '#ea580c'];
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
    toast(`设置完成，管理员是 ${r.address}`);
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
  if (h === 'temp' || h.startsWith('settings') || (h.startsWith('admin') && state.me.is_admin)) { openPage(h); return; }
  await loadList();
  if (h.startsWith('msg/')) openMsg(h.slice(4));
}
$('#boxSel').onchange = (e) => { state.box = e.target.value; state.rcpt = ''; closeReader(); loadList(); };

// ---------- 列表 ----------
$$('#folders a').forEach((a) => (a.onclick = () => {
  state.folder = a.dataset.f; location.hash = state.folder; $('#app').classList.remove('menu');
  closePage(); closeReader(); loadList();
}));
let searchT;
$('#search').addEventListener('input', (e) => { clearTimeout(searchT); searchT = setTimeout(() => { state.q = e.target.value.trim(); loadList(); }, 300); });
$('#refreshBtn').onclick = () => { loadList(); toast('已刷新'); };
$('#moreBtn').onclick = () => loadList(true);
// 菜单按钮：手机上滑出侧栏，电脑上收起或展开侧栏
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

// 收件地址筛选：这个邮箱收过两个以上地址的信时才显示
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
          <div class="item-top"><span class="who">${esc(who)}</span><span class="when">${m.has_attach ? icon('clip', 'sm') : ''}${fmtDate(m.date)}</span></div>
          <div class="subj">${tag}${esc(m.subject || '(无主题)')}</div>
          <div class="snip">${esc(m.snippet)}</div>
        </div>
        ${state.folder === 'drafts' ? '' : `<button class="star-btn ${m.starred ? 'on' : ''}" data-star title="${m.starred ? '取消星标' : '加星标'}" aria-label="星标">${icon('star')}</button>`}</div>`;
    }).join('');
  }
  $('#moreBtn').classList.toggle('hidden', state.done);
  $$('.item', el).forEach((n) => (n.onclick = () => (state.folder === 'drafts' ? openDraft(n.dataset.id) : openMsg(n.dataset.id))));
  $$('[data-star]', el).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); toggleStar(b.closest('.item').dataset.id); }));
}

// 列表里直接加星、取消星标，不用点开信
async function toggleStar(id) {
  const m = state.items.find((x) => String(x.id) === String(id));
  if (!m) return;
  const on = !m.starred;
  try { await api(`/messages/${m.id}`, { method: 'PATCH', json: { starred: on } }); } catch (x) { toast(x.message); return; }
  m.starred = on ? 1 : 0;
  if (state.folder === 'starred' && !on) state.items = state.items.filter((x) => x !== m);
  renderList();
  if (state.cur && String(state.cur.id) === String(id)) {
    state.cur.starred = m.starred;
    const b = $('#reader [data-a="star"]');
    if (b) { b.classList.toggle('starred', on); b.title = on ? '取消星标' : '加星标'; }
  }
  toast(on ? '已加星标' : '已取消星标');
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
      ${m.folder === 'sent' ? '' : `<a class="icon-btn" href="/api/messages/${m.id}/raw" title="下载原始邮件" aria-label="原始邮件">${icon('download')}</a>`}
      ${trash ? `<button class="icon-btn" data-a="restore" title="移回" aria-label="移回">${icon('restore')}</button><button class="icon-btn danger" data-a="destroy" title="彻底删除" aria-label="彻底删除">${icon('trash')}</button>` : `<button class="icon-btn" data-a="trash" title="删除" aria-label="删除">${icon('trash')}</button>`}
    </div>
    <div class="r-head">
      <h2>${esc(m.subject || '(无主题)')}</h2>
      <div class="r-from">
        ${avatar(m.from_name, m.from_addr)}
        <div class="r-meta">
          <div class="r-line"><strong>${esc(m.from_name || m.from_addr)}</strong>${m.from_name ? `<span class="muted">&lt;${esc(m.from_addr)}&gt;</span>` : ''}<span class="r-date">${fmtDate(m.date, true)}</span></div>
          <div>收件人：${esc(m.to.map(fmtAddr).join(', ') || m.envelope_to || '')}</div>
          ${m.cc.length ? `<div>抄送：${esc(m.cc.map(fmtAddr).join(', '))}</div>` : ''}
          ${m.envelope_to && !m.to.some((a) => a.address === m.envelope_to) ? `<div>投递到：<span class="rcpt">${esc(m.envelope_to)}</span></div>` : ''}
        </div>
      </div>
    </div>
    ${m.html && hasRemote && !showImages ? `<div class="notice">${icon('imageoff')}<span>已挡住外部图片，它们可能用来追踪你是否读过这封信。</span><a data-a="images">显示图片</a></div>` : ''}
    <div class="r-body" id="rBody"></div>
    ${atts.length ? `<div class="atts">${atts.map((a) => `<a class="att" href="/api/messages/${m.id}/att/${a.i}?dl=1" title="${esc(a.filename)}">${icon('file')}<span class="att-name">${esc(a.filename)}</span><span class="muted">${fmtSize(a.size)}</span></a>`).join('')}</div>` : ''}`;
  $('.mobile-back').style.display = window.innerWidth <= 1100 ? '' : 'none';

  const body = $('#rBody');
  if (m.html) {
    const ifr = document.createElement('iframe');
    // 不给 allow-scripts:信里的脚本一律不跑；allow-same-origin 只用来量高度
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
    if (a === 'star') { await api(`/messages/${m.id}`, { method: 'PATCH', json: { starred: !m.starred } }); toast(m.starred ? '已取消星标' : '已加星标'); await loadList(); return openMsg(m.id); }
    if (a === 'unread') { await api(`/messages/${m.id}`, { method: 'PATCH', json: { seen: false } }); closeReader(); return loadList(); }
    if (a === 'trash') { await api(`/messages/${m.id}`, { method: 'PATCH', json: { folder: 'trash' } }); toast('已移到垃圾箱'); }
    if (a === 'restore') { await api(`/messages/${m.id}`, { method: 'PATCH', json: { folder: 'restore' } }); toast('已移回'); }
    if (a === 'destroy') { if (!confirm('彻底删除后不能恢复，确定吗？')) return; await api(`/messages/${m.id}`, { method: 'DELETE' }); toast('已删除'); }
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
    toast(state.me.is_admin ? '还没开通发信：到「管理中心 → 发信」填 Resend Key' : '还没开通发信，请联系管理员');
    return;
  }
  cf.reset(); $('#fileNames').textContent = ''; $('#sendErr').textContent = '';
  cf.reply_to_id.value = ''; cf.draft_id.value = '';
  const myBox = state.box || state.me.address;
  // 发件人：自己的地址、别名、临时地址；回复发到别名或临时地址的信时默认用那个地址
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
        `发件人：${fmtAddr({ name: m.from_name, address: m.from_addr })}\n日期：${fmtDate(m.date, true)}\n主题：${subj}\n收件人：${m.to.map(fmtAddr).join(', ')}\n` +
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
    toast(cf.files.files.length ? '草稿已保存（附件不会存进草稿）' : '草稿已保存');
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

// ---------- 页面：临时邮箱、设置、管理中心 ----------
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
  if (name === 'settings/temp') name = 'admin/temps';
  if (name === 'admin/notify') name = 'settings/notify';
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

// 页面骨架:标题行(右边放这一页的操作) + 下面一块块白色内容
function head(title, desc, right = '') {
  return `<header class="pg-head">
    <div class="page-title"><h1>${title}</h1>${desc ? `<p>${desc}</p>` : ''}</div><div class="pg-actions" id="pgActions">${right}</div></header>`;
}
const searchBox = (id, ph) => `<div class="search">${icon('search')}<input id="${id}" type="search" placeholder="${ph}"></div>`;
// 筛选栏:左边快速筛选,右边排序
function filterBar(chips, sorts) {
  return `<div class="blk fbar">
    ${chips.map(([k, t, n], i) => `<button type="button" class="fchip ${i ? '' : 'on'}" data-f="${k}">${t} ${n}</button>`).join('')}
    <span class="spacer"></span>
    ${sorts ? `<select class="sort-sel" id="sortSel">${sorts.map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select>` : ''}
  </div>`;
}
const tblFoot = (n, unit) => `<div class="tbl-foot">共 <span data-total>${n}</span> ${unit}</div>`;
// 行上带 data-st(状态标签,空格分开)、data-q(搜索文字)、data-s1/s2/s3(排序值)
function wireList(tbody, { searchEl, sortEl } = {}) {
  if (!tbody) return;
  const rows = () => [...tbody.children];
  const apply = () => {
    const f = $('.fchip.on', page)?.dataset.f || 'all';
    const q = (searchEl?.value || '').trim().toLowerCase();
    let n = 0;
    rows().forEach((tr) => {
      const ok = (f === 'all' || (tr.dataset.st || '').split(' ').includes(f)) && (!q || (tr.dataset.q || '').includes(q));
      tr.style.display = ok ? '' : 'none';
      if (ok) n++;
    });
    const c = $('[data-total]', page);
    if (c) c.textContent = n;
  };
  const sort = () => {
    if (!sortEl) return;
    const [k, dir] = sortEl.value.split(':');
    rows().sort((a, b) => {
      const x = a.dataset['s' + k] ?? '', y = b.dataset['s' + k] ?? '';
      const c = x !== '' && y !== '' && !isNaN(x) && !isNaN(y) ? Number(x) - Number(y) : String(x).localeCompare(String(y));
      return dir === 'desc' ? -c : c;
    }).forEach((tr) => tbody.appendChild(tr));
  };
  $$('.fchip', page).forEach((b) => (b.onclick = () => { $$('.fchip', page).forEach((x) => x.classList.toggle('on', x === b)); apply(); }));
  if (searchEl) searchEl.oninput = apply;
  if (sortEl) sortEl.onchange = sort;
  sort();
}
function wire(root = page) {
  $('#meMenu').classList.add('hidden');
}

// 通用编辑弹窗：fields 是表单 HTML,onSave(FormData) 抛错时显示在弹窗里
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

// 两种转发方式：cf 原样转发(要在 Cloudflare 验证目标邮箱);send 通过 Resend 重新发出(免验证)
function fwdModeField(mode = 'cf', name = 'fwd_mode') {
  const can = state.me.can_resend;
  return `<div class="field"><span class="field-title">转发方式</span>
    <div class="choice">
      <label class="radio-card"><input type="radio" name="${name}" value="cf" ${mode !== 'send' ? 'checked' : ''}>
        <span><strong>直接转发</strong><span class="muted sm">原样转发，需在 Cloudflare 验证目标邮箱</span></span></label>
      <label class="radio-card ${can ? '' : 'off'}"><input type="radio" name="${name}" value="send" ${mode === 'send' ? 'checked' : ''} ${can ? '' : 'disabled'}>
        <span><strong>通过发信服务转发</strong><span class="muted sm">${can ? '无需验证，占用发信额度' : '需先开通发信'}</span></span></label>
    </div></div>`;
}

// ---------- 临时邮箱收件地址(管理中心 → 临时邮箱) ----------
// r: { catch_all, catch_all_fwd, locked } —— 就是兜底规则
function tempTargetPanel(r) {
  const custom = !!r.catch_all_fwd;
  const box = r.catch_all || state.me.address;
  return `<form class="panel" data-target>
    <div class="sec-head"><h2>临时邮箱收件地址</h2></div>
    <div class="choice">
      <label class="radio-card"><input type="radio" name="mode" value="admin" ${custom ? '' : 'checked'}>
        <span><strong>管理员邮箱</strong><span class="muted sm">${esc(box)}</span></span></label>
      <label class="radio-card"><input type="radio" name="mode" value="custom" ${custom ? 'checked' : ''}>
        <span><strong>外部邮箱</strong><span class="muted sm">Gmail、QQ 邮箱等</span></span></label>
    </div>
    <div data-custom class="stack ${custom ? '' : 'hidden'}">
      <label>收件邮箱<input name="fwd" type="email" value="${esc(r.catch_all_fwd)}" placeholder="例如 you@gmail.com"></label>
      ${fwdModeField(r.catch_all_fwd_mode)}
      <label class="check"><input type="checkbox" name="keep" ${!custom || r.catch_all || r.locked ? 'checked' : ''} ${r.locked ? 'disabled' : ''}>
        管理员邮箱里也保留一份</label>
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
      j = { catch_all_fwd: fwd, catch_all_fwd_mode: form.fwd_mode.value || 'cf', catch_all: form.keep.checked ? box : '' };
    }
    if (r.locked) delete j.catch_all;
    try { await api('/admin/routing', { method: 'POST', json: j }); toast('已保存，最多 30 秒后生效'); if (after) await after(); } catch (x) { toast(x.message); }
  };
}

// ---------- 临时邮箱 ----------
// 默认规则(=兜底规则)当前送到哪，用来显示自动地址的去向
let tempDefaults = null;
function defaultChips() {
  const d = tempDefaults;
  if (!d) return `<span class="chip">跟随默认规则</span>`;
  const parts = [];
  if (d.box) parts.push(`<span class="chip">${icon('inbox', 'sm')}${d.box === state.me.address ? '我的邮箱' : esc(d.box)}</span>`);
  if (d.fwd) parts.push(`<span class="chip">${icon('forward', 'sm')}${esc(d.fwd)}</span>`);
  return parts.join('') || '<span class="chip">退回</span>';
}

function tempBar(items) {
  const now = Date.now();
  const n = (f) => items.filter(f).length;
  const exp = (a) => a.expires_at && a.expires_at < now;
  return filterBar([['all', '全部', items.length], ['on', '使用中', n((a) => a.enabled && !exp(a))], ['off', '已停用', n((a) => !a.enabled)], ['exp', '已过期', n((a) => a.enabled && exp(a))]],
    [['1:desc', '按最近收信'], ['2:desc', '按收到数量'], ['3:asc', '按地址']]);
}

function tempRows(items, showOwner, reload) {
  if (!items.length) return `<div class="blk"><div class="empty small">${icon('mailclock')}<p>还没有临时地址</p></div></div>`;
  const now = Date.now();
  const rows = items.map((a) => {
    const expired = a.expires_at && a.expires_at < now;
    const st = !a.enabled ? badge('neutral', '已停用') : expired ? badge('warn', '已过期') : badge('ok', '使用中');
    const to = a.auto ? defaultChips() : `<span class="chip">${icon('inbox', 'sm')}${a.owner === state.me.address ? '我的邮箱' : esc(a.owner || '')}</span>`;
    const exp = a.expires_at ? (expired ? '已过期' : `${fmtDay(a.expires_at)} 到期`) : '永久';
    return `<tr data-q="${esc((a.address + ' ' + a.note + ' ' + a.fwd_to + ' ' + (a.owner || '')).toLowerCase())}" data-st="${!a.enabled ? 'off' : expired ? 'exp' : 'on'}" data-s1="${a.last_at || 0}" data-s2="${a.hits}" data-s3="${esc(a.address)}">
      <td><div class="addr-cell"><strong>${esc(a.address)}</strong><button class="icon-btn xs" data-copy="${esc(a.address)}" title="复制">${icon('copy')}</button></div>${a.note ? `<div class="muted sm">${esc(a.note)}</div>` : ''}</td>
      ${showOwner ? `<td>${esc(a.owner || '—')}</td>` : ''}
      <td><div class="chips">${to}</div>${a.auto ? '' : ''}</td>
      <td>${st}<div class="muted sm">${exp}</div></td>
      <td class="num">${a.hits}<div class="muted sm">${a.last_at ? '最近 ' + fmtDate(a.last_at) : '还没收到'}</div></td>
      <td class="acts">
        <button class="lnk" data-view="${esc(a.address)}" data-owner="${esc(a.owner || '')}">查看信</button>
        <button class="lnk" data-tedit="${esc(a.address)}">编辑</button>
        <button class="lnk" data-ttoggle="${esc(a.address)}" data-on="${a.enabled}" title="${a.enabled ? '停用后发来的信会被退回' : ''}">${a.enabled ? '停用' : '启用'}</button>
        <button class="lnk danger" data-tdel="${esc(a.address)}">删除</button>
      </td></tr>`;
  }).join('');
  setTimeout(() => wireTemp(items, reload));
  return `<div class="blk"><div class="table-wrap"><table class="tbl"><thead><tr><th>地址</th>${showOwner ? '<th>所属账号</th>' : ''}<th>送到</th><th>状态</th><th class="num">收到</th><th>操作</th></tr></thead><tbody class="temp-rows">${rows}</tbody></table></div>${tblFoot(items.length, '个')}</div>`;
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
    if (!confirm(`删除 ${b.dataset.tdel}?已收到的信会保留。`)) return;
    try { await api(`/temp/${encodeURIComponent(b.dataset.tdel)}`, { method: 'DELETE' }); reload(); } catch (x) { toast(x.message); }
  }));
  $$('[data-tedit]', page).forEach((b) => (b.onclick = () => {
    const a = items.find((x) => x.address === b.dataset.tedit);
    editDialog(`编辑 ${a.address}`, `
      <label>备注<input name="note" value="${esc(a.note)}" placeholder="例如：哪个网站用的"></label>
      <label>有效期<select name="days"><option value="keep">不改(${a.expires_at ? fmtDay(a.expires_at) + ' 到期' : '永久'})</option><option value="0">改成永久</option><option value="1">从现在起 1 天</option><option value="7">从现在起 7 天</option><option value="30">从现在起 30 天</option></select></label>`, async (f) => {
      const j = { note: f.get('note') };
      if (f.get('days') !== 'keep') j.days = Number(f.get('days'));
      await api(`/temp/${encodeURIComponent(a.address)}`, { method: 'PATCH', json: j });
      toast('已保存'); reload();
    });
  }));
}

function newTempDialog(domain) {
  editDialog('新建临时地址', `
    <label>地址
      <div class="addr-input"><input name="local" placeholder="留空就随机生成" autocomplete="off" autocapitalize="off" spellcheck="false"><span class="suffix">@${esc(domain)}</span>
      <button type="button" class="icon-btn" data-rand title="随机生成一个">${icon('dice')}</button></div></label>
    <div class="form-grid">
      <label>备注<input name="note" placeholder="例如：某购物网站" maxlength="100"></label>
      <label>有效期<select name="days"><option value="0">永久</option><option value="1">1 天</option><option value="7">7 天</option><option value="30">30 天</option><option value="90">90 天</option></select></label>
    </div>`, async (f) => {
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
  page.innerHTML = `<div class="pg-col">${head('临时邮箱', `任意前缀 <code>@${esc(domain)}</code> 都能直接收信`, `
    ${searchBox('tempQ', '搜索地址或备注')}
    ${state.me.is_admin ? `<label class="check"><input type="checkbox" id="tempAll" ${all ? 'checked' : ''}> 所有人的</label>` : ''}
    <button class="primary" id="newTemp">${icon('plus')}新建</button>`)}
    ${tempBar(items)}
    ${tempRows(items, all, pageTemp)}
  </div>`;
  wire();
  $('#newTemp').onclick = () => newTempDialog(domain);
  if ($('#tempAll')) $('#tempAll').onchange = (e) => { state.tempAll = e.target.checked; pageTemp(); };
  wireList($('.temp-rows', page), { searchEl: $('#tempQ'), sortEl: $('#sortSel', page) });
}

// ---------- 在 Foxmail / Outlook 里使用 ----------
// Cloudflare Workers 开不了 IMAP/POP3 服务，所以客户端收信靠「转发到外部邮箱」，发信走 Resend 的 SMTP
function clientPanel() {
  const me = state.me;
  const row = (k, v, copy = true) => `<tr><td class="muted nowrap">${k}</td><td><div class="addr-cell"><code>${esc(v)}</code>${copy ? `<button class="icon-btn xs" type="button" data-copy="${esc(v)}" title="复制">${icon('copy')}</button>` : ''}</div></td></tr>`;
  const pass = me.is_admin
    ? 'Resend API Key（建议每人单独建一个 Sending access 的 Key）'
    : 'Resend API Key，向管理员索取';
  return `<section class="panel">
    <h2>在 Foxmail / Outlook 中使用</h2>
    <div class="subs">
    <div class="sub"><h3>收信</h3>
    <p class="hint">在「转发」里转到 QQ 邮箱或 Gmail，再在客户端里添加那个邮箱。</p></div>
    <div class="sub"><h3>发信</h3>
    ${me.can_send ? '' : `<p class="hint">还没开通发信${me.is_admin ? `，<a data-goto-send>去开通</a>` : ''}</p>`}
    <div class="table-wrap"><table class="tbl mini"><tbody>
      ${row('发件服务器（SMTP）', 'smtp.resend.com')}
      ${row('端口', '465')}
      ${row('加密', 'SSL/TLS（或 587 + STARTTLS）', false)}
      ${row('用户名', 'resend')}
      <tr><td class="muted nowrap">密码</td><td class="sm">${pass}</td></tr>
      ${row('发件人地址', me.address)}
    </tbody></table></div></div>
    </div>
  </section>`;
}

// ---------- 个人设置：分类标签页，和管理中心同一种结构 ----------
const SETTINGS_TABS = [
  ['account', '账户', 'user'], ['forward', '转发', 'forward'], ['autoreply', '自动回复', 'autoreply'],
  ['notify', '通知', 'bell'], ['client', '客户端', 'devices'],
];
async function pageSettings(tab = 'account') {
  const tabs = SETTINGS_TABS.filter((t) => !t[3] || state.me.is_admin);
  if (!tabs.some((t) => t[0] === tab)) tab = 'account';
  const s = await api('/settings');
  const pct = s.quota_mb ? Math.min(100, (s.used / (s.quota_mb * 1048576)) * 100) : 0;
  const body = {
    account: `
    <section class="panel">
      <h2>用量</h2>
      <div class="usage">
        <div><div class="muted sm">存储</div><div class="big">${fmtSize(s.used)}<span class="muted"> / ${s.quota_mb ? s.quota_mb + ' MB' : '不限'}</span></div>
          ${s.quota_mb ? `<div class="meter"><span style="width:${pct}%"></span></div>` : ''}</div>
        <div><div class="muted sm">最近 24 小时发信</div><div class="big">${s.sent_24h}<span class="muted"> / ${s.send_limit ? s.send_limit + ' 封' : '不限'}</span></div></div>
      </div>
    </section>
    <form class="panel" data-sec>
      <h2>个人资料</h2>
      <label>邮箱地址<input value="${esc(state.me.address)}" disabled></label>
      <label>显示名称<input name="name" value="${esc(s.name)}" maxlength="80"></label>
      <label>签名<textarea name="signature" rows="4">${esc(s.signature)}</textarea></label>
      <div class="actions"><button class="primary" type="submit">保存</button></div>
    </form>
    <form class="panel" id="pwForm2">
      <h2>修改密码</h2>
      <label>原密码<input name="old" type="password" autocomplete="current-password" required></label>
      <label>新密码<input name="password" type="password" autocomplete="new-password" minlength="10" required placeholder="至少 10 位"></label>
      <div class="actions"><span class="error" id="pwErr"></span><button class="primary" type="submit">修改密码</button></div>
    </form>`,
    forward: `
    <form class="panel" data-sec>
      <h2>转发到外部邮箱</h2>
      <label>转发到<input name="fwd_to" type="email" value="${esc(s.fwd_to)}" placeholder="例如 you@gmail.com"></label>
      ${fwdModeField(s.fwd_mode)}
      <label class="check"><input type="checkbox" name="fwd_keep" ${s.fwd_keep ? 'checked' : ''}> 转发后在这里也保留一份</label>
      <div class="actions"><button class="primary" type="submit">保存</button></div>
    </form>`,
    autoreply: `
    <form class="panel" data-sec>
      <h2>自动回复</h2>
      <label class="switch"><input type="checkbox" name="ar_on" ${s.ar_on ? 'checked' : ''}><span class="track"></span>开启自动回复</label>
      <label>主题<input name="ar_subject" value="${esc(s.ar_subject)}" placeholder="留空就用「自动回复：原主题」"></label>
      <label>内容<textarea name="ar_body" rows="5" placeholder="你好，我这几天休假，回来后会尽快回复你。">${esc(s.ar_body)}</textarea></label>
      <label>截止日期<input name="ar_until" type="date" value="${s.ar_until ? fmtDay(s.ar_until - 1) : ''}"></label>
      <div class="actions"><button class="primary" type="submit">保存</button></div>
    </form>`,
    client: clientPanel(),
    notify: !s.tg_bot ? `
    <section class="panel">
      <h2>Telegram 通知</h2>
      <p class="status-line">${badge('neutral', '未开通')}<span class="muted">${state.me.is_admin ? '先在上面设置机器人' : '管理员还没设置 Telegram 机器人'}</span></p>
    </section>` : !s.tg_bound ? `
    <section class="panel">
      <h2>Telegram 通知</h2>
      <p class="status-line">${badge('neutral', '未绑定')}<span class="muted">新邮件推送到你的 Telegram</span></p>
      <div class="actions"><button class="primary" type="button" id="tgBind">绑定 Telegram</button></div>
      <p class="muted sm hidden" id="tgWait">在 Telegram 里点「开始」，完成后这里会自动刷新。</p>
    </section>` : `
    <form class="panel" data-sec>
      <h2>Telegram 通知</h2>
      <p class="status-line">${badge('ok', '已绑定')}<span class="muted">机器人 @${esc(s.tg_bot)}</span></p>
      <label class="check"><input type="checkbox" name="tg_body" ${s.tg_body ? 'checked' : ''}> 推送正文摘要</label>
      <label class="check"><input type="checkbox" name="tg_bulk" ${s.tg_bulk ? 'checked' : ''}> 群发、订阅类邮件也推送</label>
      <div class="actions"><button class="primary" type="submit">保存</button><button type="button" id="tgTest">发送测试消息</button><button type="button" id="tgUnbind">解除绑定</button></div>
    </form>`,
  }[tab];
  page.innerHTML = `<div class="pg-col">${head('设置')}
  <div class="blk tabs" role="tablist">${tabs.map(([k, t, ic]) => `<a data-stab="${k}" class="${k === tab ? 'on' : ''}">${icon(ic, 'sm')}${t}</a>`).join('')}</div>
  <div class="pg-stack">${tab === 'notify' && state.me.is_admin ? '<div id="tgAdmin" class="pg-stack"></div>' : ''}${body}</div></div>`;
  wire();
  if ($('#tgAdmin')) await ADMIN.notify($('#tgAdmin'));
  $$('[data-stab]', page).forEach((a) => (a.onclick = () => openPage('settings/' + a.dataset.stab)));
  $$('[data-copy]', page).forEach((b) => (b.onclick = () => copyText(b.dataset.copy)));
  if ($('[data-goto-send]', page)) $('[data-goto-send]', page).onclick = () => openPage('admin/send');
  if ($('#tgBind')) $('#tgBind').onclick = async () => {
    const w = window.open('', '_blank'); // 先开窗口，避免被浏览器当成弹窗拦掉
    try {
      const { url } = await api('/tg/link', { method: 'POST' });
      if (w) w.location = url; else location.href = url;
    } catch (x) { if (w) w.close(); toast(x.message); return; }
    $('#tgWait').classList.remove('hidden');
    let n = 0;
    const t = setInterval(async () => {
      if (++n > 100 || !$('#tgWait')) { clearInterval(t); return; }
      const x = await api('/settings').catch(() => null);
      if (x && x.tg_bound) { clearInterval(t); toast('已绑定 Telegram'); pageSettings('notify'); }
    }, 3000);
  };
  if ($('#tgTest')) $('#tgTest').onclick = async () => {
    try { await api('/tg/test', { method: 'POST' }); toast('已发送，去 Telegram 看看'); } catch (x) { toast(x.message); }
  };
  if ($('#tgUnbind')) $('#tgUnbind').onclick = async () => {
    if (!confirm('解除后不再推送新邮件，确定吗？')) return;
    try { await api('/tg/unbind', { method: 'POST' }); toast('已解除绑定'); pageSettings('notify'); } catch (x) { toast(x.message); }
  };
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
  if ($('#pwForm2')) $('#pwForm2').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    $('#pwErr').textContent = '';
    try { await api('/password', { method: 'POST', json: { old: f.get('old'), password: f.get('password') } }); e.target.reset(); toast('密码已修改，其他设备需要重新登录'); }
    catch (x) { $('#pwErr').textContent = x.message; }
  };
}

// ---------- 管理中心 ----------
const ADMIN_TABS = [
  ['overview', '概览', 'chart'], ['users', '账号', 'users'], ['addresses', '别名和群组', 'at'],
  ['temps', '临时邮箱', 'mailclock'], ['brand', '品牌', 'palette'], ['send', '发信', 'send'], ['logs', '记录', 'history'],
];

async function pageAdmin(tab = 'overview') {
  if (!state.me.is_admin) return;
  if (!ADMIN_TABS.some((t) => t[0] === tab)) tab = 'overview';
  page.innerHTML = `<div class="pg-col">${head('管理中心')}
    <div class="blk tabs" role="tablist">${ADMIN_TABS.map(([k, t, ic]) => `<a data-tab="${k}" class="${k === tab ? 'on' : ''}">${icon(ic, 'sm')}${t}</a>`).join('')}</div>
    <div class="pg-stack" id="tabBody"><div class="blk"><div class="empty small"><p>加载中…</p></div></div></div></div>`;
  wire();
  $$('[data-tab]', page).forEach((a) => (a.onclick = () => openPage('admin/' + a.dataset.tab)));
  await ADMIN[tab]($('#tabBody'));
}

const LOG_KINDS = {
  login: ['ok', '登录成功'], login_fail: ['bad', '登录失败'], deliver: ['ok', '已投递'], reject: ['neutral', '已退回'],
  forward: ['ok', '已转发'], forward_fail: ['bad', '转发失败'], quota: ['warn', '邮箱已满'], autoreply: ['ok', '自动回复'],
  autoreply_fail: ['bad', '自动回复失败'], tg_fail: ['bad', '推送失败'], send: ['ok', '已发送'], send_fail: ['bad', '发送失败'],
};

const ADMIN = {
  async overview(el) {
    const o = await api('/admin/overview');
    const days = Array.from({ length: 14 }, (_, i) => { const d = 13 - i; const r = o.days.find((x) => x.d === d) || {}; return { d, recv: r.recv || 0, sent: r.sent || 0 }; });
    const max = Math.max(1, ...days.map((x) => x.recv));
    const label = (d) => { const t = new Date(Date.now() - d * DAY_MS); return `${t.getMonth() + 1}/${t.getDate()}`; };
    const tile = (k, v, sub = '') => `<div class="blk tile"><div class="muted sm">${k}</div><div class="tile-v">${v}</div>${sub ? `<div class="muted sm">${sub}</div>` : ''}</div>`;
    const alerts = [];
    if (!o.can_send) alerts.push(`<div class="blk alert">${icon('send')}<span>还没开通发信，账号只能收信。</span><a data-goto="send">去设置</a></div>`);
    if (o.fwd_fail_7d) alerts.push(`<div class="blk alert bad">${icon('forward')}<span>最近 7 天有 ${o.fwd_fail_7d} 次转发失败，多半是外部邮箱还没在 Cloudflare 验证。</span><a data-goto="logs">看记录</a></div>`);
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
    $('#pgActions').innerHTML = `${searchBox('userQ', '搜索账号')}<button id="batchUsers">批量创建</button><button class="primary" id="newUser">${icon('plus')}新建账号</button>`;
    const n = (f) => items.filter(f).length;
    el.innerHTML = `${filterBar([['all', '全部', items.length], ['ok', '正常', n((u) => !u.disabled)], ['off', '已停用', n((u) => u.disabled)], ['admin', '管理员', n((u) => u.is_admin)]],
      [['1:desc', '按最近登录'], ['2:desc', '按用量'], ['3:asc', '按名称']])}
      <div class="blk"><div class="table-wrap"><table class="tbl"><thead><tr><th>账号</th><th>状态</th><th>转发</th><th>用量</th><th>最近登录</th><th>操作</th></tr></thead><tbody id="userRows">
      ${items.map((u) => `<tr data-q="${esc((u.address + ' ' + u.name + ' ' + (u.aliases || '')).toLowerCase())}" data-st="${u.disabled ? 'off' : 'ok'}${u.is_admin ? ' admin' : ''}" data-s1="${u.last_login || 0}" data-s2="${u.used || 0}" data-s3="${esc(u.name || u.address)}">
        <td><div class="who-cell">${avatar(u.name, u.address)}<div><div><strong>${esc(u.name || u.address.split('@')[0])}</strong> ${u.is_admin ? badge('accent', '管理员') : ''}</div>
          <div class="muted sm">${esc(u.address)}${u.aliases ? ` · 别名 ${esc(u.aliases)}` : ''}</div></div></div></td>
        <td>${u.disabled ? badge('neutral', '已停用') : badge('ok', '正常')}${u.ar_on ? '<div class="muted sm">自动回复中</div>' : ''}</td>
        <td>${u.fwd_to ? `${esc(u.fwd_to)}${u.fwd_mode === 'send' ? '<div class="muted sm">通过发信服务</div>' : ''}` : '<span class="muted">—</span>'}</td>
        <td>${fmtSize(u.used)}${u.quota_mb ? ` / ${u.quota_mb} MB` : ''}<div class="muted sm">${u.total} 封${u.send_limit ? ` · 每天最多发 ${u.send_limit} 封` : ''}</div></td>
        <td>${ago(u.last_login)}</td>
        <td class="acts">
          <button class="lnk" data-uedit="${u.id}">编辑</button>
          <button class="lnk" data-upw="${u.id}">重设密码</button>
          <button class="lnk" data-uout="${u.id}" title="让它在所有设备退出登录">退出登录</button>
          ${u.address === state.me.address ? '' : `<button class="lnk danger" data-udel="${u.id}">删除</button>`}
        </td></tr>`).join('')}</tbody></table></div>${tblFoot(items.length, '个账号')}</div>`;
    const reload = () => ADMIN.users(el);
    wireList($('#userRows'), { searchEl: $('#userQ'), sortEl: $('#sortSel', el) });
    const userFields = (u = {}) => `
      ${u.id ? '' : `<label>地址<div class="addr-input"><input name="local" required autocomplete="off" autocapitalize="off" spellcheck="false"><span class="suffix">@${esc(domain)}</span></div></label>`}
      <label>显示名称<input name="name" value="${esc(u.name || '')}" maxlength="80"></label>
      ${u.id ? '' : '<label>密码<input name="password" type="password" minlength="10" required autocomplete="new-password" placeholder="至少 10 位"></label>'}
      <div class="form-grid">
        <label>存储上限（MB，0 为不限）<input name="quota_mb" type="number" min="0" value="${u.quota_mb || 0}"></label>
        <label>每天发信上限（0 为不限）<input name="send_limit" type="number" min="0" value="${u.send_limit || 0}"></label>
      </div>
      <label>转发到<input name="fwd_to" type="email" value="${esc(u.fwd_to || '')}" placeholder="例如 someone@gmail.com"></label>
      ${fwdModeField(u.fwd_mode)}
      <label class="check"><input type="checkbox" name="is_admin" ${u.is_admin ? 'checked' : ''}> 管理员</label>
      ${u.id ? `<label class="check"><input type="checkbox" name="disabled" ${u.disabled ? 'checked' : ''}> 停用这个账号（不能登录，发来的信会被退回）</label>` : ''}`;
    $('#newUser').onclick = () => editDialog('新建账号', userFields(), async (f) => {
      await api('/admin/users', { method: 'POST', json: {
        address: `${String(f.get('local')).trim().toLowerCase()}@${domain}`, name: f.get('name'), password: f.get('password'),
        is_admin: f.get('is_admin') === 'on', quota_mb: Number(f.get('quota_mb')), send_limit: Number(f.get('send_limit')), fwd_to: f.get('fwd_to'), fwd_mode: f.get('fwd_mode') || 'cf',
      } });
      toast('已创建'); reload();
    }, '创建');
    $$('[data-uedit]', el).forEach((b) => (b.onclick = () => {
      const u = items.find((x) => String(x.id) === b.dataset.uedit);
      editDialog(`编辑 ${u.address}`, userFields(u), async (f) => {
        await api(`/admin/users/${u.id}`, { method: 'PATCH', json: {
          name: f.get('name'), quota_mb: Number(f.get('quota_mb')), send_limit: Number(f.get('send_limit')), fwd_to: f.get('fwd_to'), fwd_mode: f.get('fwd_mode') || 'cf',
          is_admin: f.get('is_admin') === 'on', disabled: f.get('disabled') === 'on',
        } });
        toast('已保存'); reload();
      });
    }));
    $$('[data-upw]', el).forEach((b) => (b.onclick = () => {
      const u = items.find((x) => String(x.id) === b.dataset.upw);
      editDialog(`重设 ${u.address} 的密码`, `<label>新密码
        <div class="addr-input"><input name="password" minlength="10" required autocomplete="new-password" value="${genPassword()}"><button type="button" class="icon-btn" data-gen title="换一个">${icon('dice')}</button></div></label>`, async (f) => {
        await api(`/admin/users/${u.id}/password`, { method: 'POST', json: { password: f.get('password') } });
        copyText(f.get('password')); toast('密码已重设，新密码已复制');
      }, '重设');
      $('[data-gen]').onclick = () => { $('#editForm').password.value = genPassword(); };
    }));
    $$('[data-uout]', el).forEach((b) => (b.onclick = async () => {
      if (!confirm('让这个账号在所有设备上退出登录？')) return;
      try { await api(`/admin/users/${b.dataset.uout}/logout`, { method: 'POST' }); toast(b.dataset.uout === String(state.me.id) ? '已退出' : '已让它退出登录'); } catch (x) { toast(x.message); }
    }));
    $$('[data-udel]', el).forEach((b) => (b.onclick = async () => {
      const u = items.find((x) => String(x.id) === b.dataset.udel);
      if (!confirm(`删除账号 ${u.address}?它的别名和临时地址也会删除。已收的信会保留，管理员仍能查看。`)) return;
      try { await api(`/admin/users/${u.id}`, { method: 'DELETE' }); toast('已删除'); reload(); } catch (x) { toast(x.message); }
    }));
    $('#batchUsers').onclick = () => batchDialog(domain, reload);
  },

  async addresses(el) {
    const [{ items }, { items: users }] = await Promise.all([api('/admin/addresses'), api('/admin/users')]);
    const domain = (state.me.domains || [])[0] || '';
    $('#pgActions').innerHTML = `${searchBox('addrQ', '搜索地址或备注')}<button class="primary" id="newAddr">${icon('plus')}新建</button>`;
    const n = (f) => items.filter(f).length;
    el.innerHTML = `${filterBar([['all', '全部', items.length], ['alias', '别名', n((a) => a.kind !== 'group')], ['group', '群组', n((a) => a.kind === 'group')], ['off', '已停用', n((a) => !a.enabled)]],
      [['1:desc', '按收到数量'], ['2:asc', '按地址']])}
      <div class="blk">${items.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>地址</th><th>类型</th><th>送到</th><th class="num">收到</th><th>状态</th><th>操作</th></tr></thead><tbody id="addrRows">
      ${items.map((a) => `<tr data-q="${esc((a.address + ' ' + (a.note || '') + ' ' + (a.kind === 'group' ? a.members.join(' ') : a.owner)).toLowerCase())}" data-st="${a.kind === 'group' ? 'group' : 'alias'}${a.enabled ? '' : ' off'}" data-s1="${a.hits}" data-s2="${esc(a.address)}">
        <td><div class="addr-cell"><strong>${esc(a.address)}</strong><button class="icon-btn xs" data-copy="${esc(a.address)}" title="复制">${icon('copy')}</button></div>${a.note ? `<div class="muted sm">${esc(a.note)}</div>` : ''}</td>
        <td>${a.kind === 'group' ? badge('accent', '群组') : badge('neutral', '别名')}</td>
        <td><div class="chips">${(a.kind === 'group' ? a.members : [a.owner]).map((m) => `<span class="chip">${esc(m)}</span>`).join('')}</div></td>
        <td class="num">${a.hits}<div class="muted sm">${a.last_at ? fmtDate(a.last_at) : ''}</div></td>
        <td>${a.enabled ? badge('ok', '使用中') : badge('neutral', '已停用')}</td>
        <td class="acts">
          <button class="lnk" data-aedit="${esc(a.address)}">编辑</button>
          <button class="lnk" data-atoggle="${esc(a.address)}" data-on="${a.enabled}">${a.enabled ? '停用' : '启用'}</button>
          <button class="lnk danger" data-adel="${esc(a.address)}">删除</button>
        </td></tr>`).join('')}</tbody></table></div>${tblFoot(items.length, '个')}` : `<div class="empty small">${icon('at')}<p>还没有别名或群组</p></div>`}</div>`;
    wireList($('#addrRows'), { searchEl: $('#addrQ'), sortEl: $('#sortSel', el) });
    const reload = () => ADMIN.addresses(el);
    const userOpts = (sel) => users.map((u) => `<option value="${esc(u.address)}" ${u.address === sel ? 'selected' : ''}>${esc(u.address)}${u.name ? ' · ' + esc(u.name) : ''}</option>`).join('');
    $$('[data-copy]', el).forEach((b) => (b.onclick = () => copyText(b.dataset.copy)));
    $('#newAddr').onclick = () => {
      editDialog('新建别名或群组', `
        <div class="seg"><label><input type="radio" name="kind" value="alias" checked><span>别名</span></label><label><input type="radio" name="kind" value="group"><span>群组</span></label></div>
        <label>地址<div class="addr-input"><input name="local" required autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="例如 sales"><span class="suffix">@${esc(domain)}</span></div></label>
        <label data-k="alias">属于哪个账号<select name="owner">${userOpts()}</select></label>
        <label data-k="group" class="hidden">成员（每行一个）<textarea name="members" rows="4" placeholder="alice@${esc(domain)}&#10;bob@${esc(domain)}"></textarea></label>
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
        ? `<label>成员（每行一个）<textarea name="members" rows="5">${esc(a.members.join('\n'))}</textarea></label>`
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
    const [route, { items }] = await Promise.all([api('/admin/routing'), api('/temp?all=1')]);
    $('#pgActions').innerHTML = searchBox('tempQ', '搜索地址、备注或账号');
    el.innerHTML = `${tempTargetPanel(route)}${tempBar(items)}${tempRows(items, true, () => ADMIN.temps(el))}`;
    wireTempTarget($('[data-target]', el), route, () => ADMIN.temps(el));
    wireList($('.temp-rows', el), { searchEl: $('#tempQ'), sortEl: $('#sortSel', el) });
  },

  async brand(el) {
    const b = await api('/brand');
    el.innerHTML = `<div class="narrow-col">
      <form class="panel" id="brandName">
        <h2>系统名称</h2>
        <label>名称
          <input name="name" value="${esc(b.name)}" maxlength="40" placeholder="OneMail"></label>
        <div class="actions"><button class="primary" type="submit">保存</button></div>
      </form>
      <section class="panel">
        <h2>Logo</h2>
        <div class="logo-edit">
          <span class="logo logo-lg ${b.logo ? 'has-img' : ''}">${b.logo ? `<img src="${esc(b.logo)}" alt="">` : DEFAULT_LOGO}</span>
          <div class="stack">
            <p class="hint">正方形 PNG / SVG，不超过 512KB</p>
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
      secret: [badge('ok', '已开通'), `用的是 Worker 机密里的 Key（…${esc(r.tail)}），这里改不了`],
      settings: [badge('ok', '已开通'), `Resend Key 结尾 …${esc(r.tail)}`],
      cloudflare: [badge('warn', 'Cloudflare 发信'), '需要 Workers 付费版。填了 Resend Key 会改用 Resend'],
    }[r.source] || [badge('neutral', '未开通'), '填一个 Resend API Key 就能发信'];
    el.innerHTML = `<div class="narrow-col"><section class="panel">
      <h2>发信（Resend）</h2>
      <p class="status-line">${status[0]}<span class="muted">${status[1]}</span></p>
      <form id="resendForm2" class="inline-form ${r.source === 'secret' ? 'hidden' : ''}">
        <input name="key" type="password" placeholder="re_ 开头的 API Key" autocomplete="off">
        <button class="primary" type="submit">保存</button>
        ${r.source === 'settings' ? '<button type="button" id="resendClear2">清除</button>' : ''}
      </form>
      <ol class="steps">
        <li>在 <a href="https://resend.com" target="_blank" rel="noopener">resend.com</a> 添加并验证域名 <code>${esc((state.me.domains || [])[0] || '')}</code></li>
        <li>创建 API Key，粘贴到上面</li>
      </ol>
    </section></div>`;
    const save = async (key) => {
      try { const x = await api('/admin/send', { method: 'POST', json: { key } }); toast(x.note); state.me = await api('/me'); ADMIN.send(el); } catch (x) { toast(x.message); }
    };
    $('#resendForm2').onsubmit = (e) => { e.preventDefault(); const k = e.target.key.value.trim(); if (k) save(k); };
    if ($('#resendClear2')) $('#resendClear2').onclick = () => { if (confirm('清除后就不能发信了，确定吗？')) save(''); };
  },

  async notify(el) {
    const r = await api('/admin/telegram');
    el.innerHTML = `<section class="panel">
      <h2>Telegram 机器人 <span class="count">管理员</span></h2>
      <p class="status-line">${r.bot ? `${badge('ok', '已连接')}<span class="muted">@${esc(r.bot)}，${r.bound} 人已绑定</span>` : `${badge('neutral', '未设置')}<span class="muted">设置后，每个人可以在这里绑定自己的 Telegram</span>`}</p>
      <form id="tgForm" class="inline-form">
        <input name="token" type="password" placeholder="${r.bot ? '换一个机器人 Token' : '机器人 Token，如 123456789:AAH…'}" autocomplete="off">
        <button class="primary" type="submit">保存</button>
        ${r.bot ? '<button type="button" id="tgClear">断开</button>' : ''}
      </form>
      <ol class="steps">
        <li>在 Telegram 打开 <a href="https://t.me/BotFather" target="_blank" rel="noopener">@BotFather</a>,发送 <code>/newbot</code>,按提示给机器人起名</li>
        <li>复制它回复的 Token，粘贴到上面保存</li>
      </ol>
    </section>`;
    const save = async (token) => {
      try { const x = await api('/admin/telegram', { method: 'POST', json: { token } }); toast(x.note); pageSettings('notify'); } catch (x) { toast(x.message); }
    };
    $('#tgForm').onsubmit = (e) => { e.preventDefault(); const t = e.target.token.value.trim(); if (t) save(t); };
    if ($('#tgClear')) $('#tgClear').onclick = () => { if (confirm('断开后所有人的 Telegram 绑定都会解除，确定吗？')) save(''); };
  },

  async logs(el, type = 'mail', q = '') {
    const { items } = await api(`/admin/logs?type=${type}&q=${encodeURIComponent(q)}`);
    const cols = type === 'login' ? ['时间', '结果', '账号', 'IP', '详情'] : ['时间', '结果', type === 'send' ? '发件人' : '发件人', type === 'send' ? '收件人' : '收件地址', '详情'];
    if (!$('#logQ')) $('#pgActions').innerHTML = searchBox('logQ', '按地址搜索');
    el.innerHTML = `<div class="blk fbar">${[['mail', '收信'], ['send', '发信'], ['login', '登录']].map(([k, t]) => `<button type="button" class="ltype fchip ${k === type ? 'on' : ''}" data-lt="${k}">${t}</button>`).join('')}</div>
      <div class="blk">${items.length ? `<div class="table-wrap"><table class="tbl"><thead><tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>
      ${items.map((x) => { const k = LOG_KINDS[x.kind] || ['neutral', x.kind]; return `<tr>
        <td class="nowrap">${fmtDate(x.at, true)}</td><td>${badge(k[0], k[1])}</td><td>${esc(x.actor)}</td>
        <td>${esc(type === 'login' ? x.ip : x.target)}</td><td class="detail">${esc(x.detail)}</td></tr>`; }).join('')}
      </tbody></table></div>${tblFoot(items.length, '条')}` : `<div class="empty small">${icon('history')}<p>没有记录</p></div>`}</div>`;
    $$('[data-lt]', el).forEach((b) => (b.onclick = () => ADMIN.logs(el, b.dataset.lt, $('#logQ').value.trim())));
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
    <label>每行一个：用户名，密码，显示名称（密码可留空）
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
    $('#batchMsg').textContent = `完成：成功 ${ok} 个，失败 ${rows.length - ok} 个。密码只显示这一次，请下载保存。`;
    $('#batchCsv').classList.toggle('hidden', !ok);
    form.lines.value = '';
    reload();
    throw new Error(''); // 保持弹窗打开，方便下载结果
  }, '开始创建');
  $('#batchCsv').onclick = () => {
    const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = '﻿地址，密码，显示名称，结果\n' + results.map((r) => [r.address, r.result === '成功' ? r.password : '', r.name, r.result].map(q).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `mail-accounts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
}

const PAGES = { temp: pageTemp, settings: pageSettings, admin: pageAdmin };
window.addEventListener('hashchange', () => {
  const h = location.hash.slice(1);
  if (state.me && (h === 'temp' || h.startsWith('settings') || h.startsWith('admin'))) openPage(h);
  else if (state.me && h.startsWith('msg/')) { closePage(); openMsg(h.slice(4)); }
});

fillIcons();
api('/brand').then(applyBrand).catch(() => {}).finally(boot);
