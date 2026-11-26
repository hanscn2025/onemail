// 一个 IMAP 连接。支持 IMAP4rev1 常用命令，外加 IDLE、UIDPLUS、MOVE、SPECIAL-USE、ID、NAMESPACE、UNSELECT。
import tls from 'node:tls';
import crypto from 'node:crypto';
import { AuthError, ApiError } from './api.js';
import { toCRLF, parseMessage, headerFields, envelope, bodyStructure, sectionText, nstr } from './mime.js';

export const VERSION = '1.0.0';

// 文件夹映射：IMAP 名称 ↔ OneMail 文件夹
const FOLDERS = [
  { name: 'INBOX', f: 'inbox', use: '' },
  { name: 'Sent', f: 'sent', use: '\\Sent' },
  { name: 'Drafts', f: 'drafts', use: '\\Drafts' },
  { name: 'Trash', f: 'trash', use: '\\Trash' },
  { name: 'Starred', f: 'starred', use: '\\Flagged' },
];
// 常见客户端的其他叫法
const ALIASES = { 'sent items': 'sent', 'sent messages': 'sent', 'deleted items': 'trash', 'deleted messages': 'trash', flagged: 'starred', '已发送': 'sent', '草稿箱': 'drafts', '已删除': 'trash', '垃圾箱': 'trash' };
function findFolder(name) {
  const n = String(name || '').replace(/\/+$/, '');
  const low = n.toLowerCase();
  return FOLDERS.find((x) => x.name.toLowerCase() === low) || FOLDERS.find((x) => x.f === ALIASES[low]) || null;
}

const SEEN = 1, STAR = 2;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');
const imapDate = (ms) => { const d = new Date(ms); return `"${pad(d.getUTCDate())}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} +0000"`; };
function parseSearchDate(s) {
  const m = String(s).match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!m) return null;
  const mon = MONTHS.findIndex((x) => x.toLowerCase() === m[2].toLowerCase());
  return mon < 0 ? null : Date.UTC(Number(m[3]), mon, Number(m[1]));
}
function parseAppendDate(s) {
  const m = String(s).match(/^\s*(\d{1,2})-([A-Za-z]{3})-(\d{4}) (\d\d):(\d\d):(\d\d) ([+-])(\d\d)(\d\d)$/);
  if (!m) return 0;
  const mon = MONTHS.findIndex((x) => x.toLowerCase() === m[2].toLowerCase());
  const off = (Number(m[8]) * 60 + Number(m[9])) * 60000 * (m[7] === '+' ? 1 : -1);
  return Date.UTC(Number(m[3]), mon, Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6])) - off;
}

// ---------- 进程内共享状态 ----------
// 不能存进 OneMail 的标志(\Deleted、\Answered、自定义关键字):按 用户|文件夹|UID 记在内存里
const extraFlags = new Map();
const flagKey = (user, folder, uid) => `${user}|${folder}|${uid}`;
// 登录结果缓存 10 分钟，客户端频繁重连时不用每次都校验密码
const loginCache = new Map();
// 文件夹列表缓存：同一账号的多个连接共用，按 OneMail 的邮箱版本号失效(轮询时只读版本号这一行)
const boxCache = new Map();
// 最近读过的原文(BODYSTRUCTURE 后紧接着取各段时复用)
const rawCache = new Map();
const RAW_CACHE_BYTES = 64 * 1024 * 1024;
let rawCacheSize = 0;
function cacheRaw(key, entry) {
  if (rawCache.has(key)) return;
  rawCache.set(key, entry);
  rawCacheSize += entry.s.length;
  while (rawCacheSize > RAW_CACHE_BYTES && rawCache.size > 1) {
    const [k, v] = rawCache.entries().next().value;
    rawCache.delete(k); rawCacheSize -= v.s.length;
  }
}

// ---------- 命令解析 ----------
class Lit { constructor(buf) { this.buf = buf; } toString() { return this.buf.toString('latin1'); } }

// 把一行(字面量已替换成 \0序号\0)拆成 token:字符串、Lit、数组(括号)
function tokenize(text, lits) {
  let i = 0;
  const parseList = (close) => {
    const out = [];
    while (i < text.length) {
      const c = text[i];
      if (c === ' ') { i++; continue; }
      if (c === close) { i++; return out; }
      if (c === '(') { i++; out.push(parseList(')')); continue; }
      if (c === '"') {
        let s = ''; i++;
        while (i < text.length && text[i] !== '"') { if (text[i] === '\\') i++; s += text[i++] ?? ''; }
        i++; out.push(s); continue;
      }
      if (c === '\0') { const j = text.indexOf('\0', i + 1); out.push(new Lit(lits[Number(text.slice(i + 1, j))])); i = j + 1; continue; }
      let s = '';
      while (i < text.length && text[i] !== ' ' && text[i] !== ')' && text[i] !== close) {
        if (text[i] === '[') { const j = matchBracket(text, i); s += text.slice(i, j + 1); i = j + 1; continue; }
        if (text[i] === '(') break;
        s += text[i++];
      }
      out.push(s);
    }
    return out;
  };
  return parseList(null);
}
function matchBracket(t, i) {
  let d = 0;
  for (let j = i; j < t.length; j++) { if (t[j] === '[') d++; else if (t[j] === ']' && --d === 0) return j; }
  return t.length - 1;
}
const str = (t) => (t instanceof Lit ? t.toString() : Array.isArray(t) ? '' : String(t ?? ''));
const utf8 = (t) => Buffer.from(str(t), 'latin1').toString('utf8');

// 序号集合 "1:3,5,7:*"
function parseSet(s, star) {
  const ranges = [];
  for (const p of String(s).split(',')) {
    const [a, b = a] = p.split(':');
    const x = a === '*' ? star : Number(a), y = b === '*' ? star : Number(b);
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) throw new Error('bad sequence set');
    ranges.push([Math.min(x, y), Math.max(x, y)]);
  }
  return (n) => ranges.some(([lo, hi]) => n >= lo && n <= hi);
}
function compactSet(nums) {
  const a = [...nums].sort((x, y) => x - y), out = [];
  for (let i = 0; i < a.length; i++) {
    let j = i;
    while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++;
    out.push(i === j ? `${a[i]}` : `${a[i]}:${a[j]}`);
    i = j;
  }
  return out.join(',');
}

class Bad extends Error {}
class No extends Error {}

export class Session {
  constructor(socket, { api, secure, secureContext, port, allowPlainLogin, pollSeconds, log }) {
    this.api = api;
    this.secure = secure;
    this.secureContext = secureContext;
    this.allowPlainLogin = allowPlainLogin;
    this.pollMs = Math.max(5, pollSeconds) * 1000;
    this.log = log;
    this.ip = (socket.remoteAddress || '').replace(/^::ffff:/, '');
    this.buf = Buffer.alloc(0);
    this.pendText = ''; this.pendLits = []; this.litNeed = null;
    this.queue = Promise.resolve();
    this.user = null; this.token = null; this.sel = null;
    this.idle = null; this.saslTag = null; this.clientId = '';
    this.closed = false;
    this.attach(socket);
    this.send(`* OK [CAPABILITY ${this.caps()}] OneMail IMAP ready`);
  }

  attach(socket) {
    this.sock = socket;
    socket.setTimeout(31 * 60 * 1000, () => { this.send('* BYE Autologout; idle for too long'); this.end(); });
    socket.on('data', (d) => this.onData(d));
    socket.on('error', () => this.end());
    socket.on('close', () => this.end());
  }

  caps() {
    const c = ['IMAP4rev1', 'LITERAL+', 'SASL-IR', 'ID', 'IDLE', 'NAMESPACE', 'UIDPLUS', 'MOVE', 'SPECIAL-USE', 'UNSELECT', 'CHILDREN', 'ENABLE'];
    if (!this.user) {
      if (!this.secure) c.push('STARTTLS');
      if (!this.secure && !this.allowPlainLogin) c.push('LOGINDISABLED');
      else c.push('AUTH=PLAIN');
    }
    return c.join(' ');
  }

  send(s) {
    if (this.closed) return;
    this.sock.write(Buffer.isBuffer(s) ? s : Buffer.from(s + '\r\n', 'latin1'));
  }

  end() {
    if (this.closed) return;
    this.closed = true;
    if (this.idle) clearInterval(this.idle.timer);
    try { this.sock.end(); } catch {}
    setTimeout(() => { try { this.sock.destroy(); } catch {} }, 2000);
  }

  // ---------- 读入：按行切，处理 {n} / {n+} 字面量 ----------
  onData(d) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, d]) : d;
    this.queue = this.queue.then(() => this.drain()).catch((e) => { this.log('error', e.stack || e.message); this.end(); });
  }

  async drain() {
    while (!this.closed) {
      if (this.litNeed !== null) {
        if (this.buf.length < this.litNeed) return;
        this.pendText += `\0${this.pendLits.length}\0`;
        this.pendLits.push(this.buf.subarray(0, this.litNeed));
        this.buf = this.buf.subarray(this.litNeed);
        this.litNeed = null;
        continue;
      }
      const i = this.buf.indexOf('\r\n');
      if (i < 0) {
        if (this.buf.length > 64 * 1024) { this.send('* BYE Line too long'); this.end(); }
        return;
      }
      const line = this.buf.subarray(0, i).toString('latin1');
      this.buf = this.buf.subarray(i + 2);
      const m = line.match(/\{(\d+)(\+?)\}$/);
      if (m) {
        const n = Number(m[1]);
        if (n > 30 * 1024 * 1024) { this.send('* BYE Literal too large'); this.end(); return; }
        if (!this.user && n > 8192) { this.send('* BYE Literal too large'); this.end(); return; }
        this.pendText += line.slice(0, m.index);
        this.litNeed = n;
        if (!m[2]) this.send('+ Ready for literal data');
        continue;
      }
      const text = this.pendText + line, lits = this.pendLits;
      this.pendText = ''; this.pendLits = [];
      await this.handle(text, lits);
    }
  }

  async handle(text, lits) {
    // IDLE 中只接受 DONE
    if (this.idle) {
      const { tag, timer } = this.idle;
      clearInterval(timer); this.idle = null;
      if (text.trim().toUpperCase() === 'DONE') this.send(`${tag} OK IDLE terminated`);
      else this.send(`${tag} BAD Expected DONE`);
      return;
    }
    // AUTHENTICATE PLAIN 的第二步
    if (this.saslTag) {
      const tag = this.saslTag; this.saslTag = null;
      if (text.trim() === '*') { this.send(`${tag} BAD Authentication cancelled`); return; }
      await this.run(tag, () => this.saslPlain(tag, text.trim()));
      return;
    }
    const sp = text.indexOf(' ');
    const tag = sp < 0 ? text : text.slice(0, sp);
    if (!tag || sp < 0) { this.send(`${tag || '*'} BAD Missing command`); return; }
    let rest = text.slice(sp + 1);
    let cmd = rest.split(' ')[0].toUpperCase();
    rest = rest.slice(cmd.length + 1);
    let uid = false;
    if (cmd === 'UID') { uid = true; cmd = rest.split(' ')[0].toUpperCase(); rest = rest.slice(cmd.length + 1); }
    let args;
    try { args = tokenize(rest, lits); } catch { this.send(`${tag} BAD Parse error`); return; }
    await this.run(tag, () => this.dispatch(tag, cmd, args, uid));
  }

  async run(tag, fn) {
    try { await fn(); } catch (e) {
      if (e instanceof AuthError) { this.send('* BYE Session expired, please log in again'); this.end(); return; }
      if (e instanceof Bad) this.send(`${tag} BAD ${e.message}`);
      else if (e instanceof No) this.send(`${tag} NO ${e.message}`);
      else if (e instanceof ApiError) {
        this.log('warn', `${this.user || '-'} api: ${e.status} ${e.message}`);
        const code = e.status === 0 ? '[UNAVAILABLE] ' : e.status === 507 ? '[OVERQUOTA] ' : e.status === 413 ? '[TOOBIG] ' : '';
        this.send(`${tag} NO ${code}${/^[\x20-\x7e]*$/.test(e.message) ? e.message : `Request rejected by OneMail (HTTP ${e.status})`}`);
      }
      else { this.log('error', e.stack || e.message); this.send(`${tag} BAD ${ascii(e.message)}`); }
    }
  }

  needAuth() { if (!this.user) throw new Bad('Log in first'); }
  needSel() { this.needAuth(); if (!this.sel) throw new Bad('No mailbox selected'); }

  async dispatch(tag, cmd, a, uid) {
    switch (cmd) {
      case 'CAPABILITY': this.send(`* CAPABILITY ${this.caps()}`); return this.ok(tag, 'CAPABILITY completed');
      case 'NOOP': case 'CHECK': if (this.sel) await this.refresh(true); return this.ok(tag, `${cmd} completed`);
      case 'LOGOUT': this.send('* BYE Logging out'); this.ok(tag, 'LOGOUT completed'); return this.end();
      case 'ID': {
        if (Array.isArray(a[0])) {
          const l = a[0].map(str);
          for (let i = 0; i + 1 < l.length; i += 2) if (/^name$/i.test(l[i])) this.clientId = l[i + 1].slice(0, 60);
        }
        this.send(`* ID ("name" "OneMail IMAP Bridge" "version" "${VERSION}")`);
        return this.ok(tag, 'ID completed');
      }
      case 'STARTTLS': return this.starttls(tag);
      case 'LOGIN': return this.login(tag, utf8(a[0]), utf8(a[1]));
      case 'AUTHENTICATE': {
        if (str(a[0]).toUpperCase() !== 'PLAIN') throw new No('Unsupported authentication mechanism');
        if (a[1]) return this.saslPlain(tag, str(a[1]));
        this.saslTag = tag; this.send('+ '); return;
      }
      case 'ENABLE': this.needAuth(); this.send('* ENABLED'); return this.ok(tag, 'ENABLE completed');
      case 'NAMESPACE': this.needAuth(); this.send('* NAMESPACE (("" "/")) NIL NIL'); return this.ok(tag, 'NAMESPACE completed');
      case 'LIST': case 'LSUB': case 'XLIST': this.needAuth(); return this.list(tag, cmd, a);
      case 'STATUS': this.needAuth(); return this.status(tag, a);
      case 'SELECT': case 'EXAMINE': this.needAuth(); return this.select(tag, str(a[0]), cmd === 'EXAMINE');
      case 'CREATE': case 'DELETE': case 'RENAME': this.needAuth(); throw new No('[CANNOT] Custom folders are not supported');
      case 'SUBSCRIBE': case 'UNSUBSCRIBE': this.needAuth(); return this.ok(tag, `${cmd} completed`);
      case 'APPEND': this.needAuth(); return this.append(tag, a);
      case 'UNSELECT': this.needSel(); this.sel = null; return this.ok(tag, 'UNSELECT completed');
      case 'CLOSE': this.needSel(); if (!this.sel.ro) await this.expunge(null, true); this.sel = null; return this.ok(tag, 'CLOSE completed');
      case 'EXPUNGE': this.needSel(); if (this.sel.ro) throw new No('Mailbox is read-only');
        await this.expunge(uid ? this.uidPred(str(a[0])) : null); return this.ok(tag, 'EXPUNGE completed');
      case 'SEARCH': this.needSel(); return this.search(tag, a, uid);
      case 'FETCH': this.needSel(); return this.fetch(tag, a, uid);
      case 'STORE': this.needSel(); return this.store(tag, a, uid);
      case 'COPY': case 'MOVE': this.needSel(); return this.copy(tag, a, uid, cmd === 'MOVE');
      case 'IDLE': {
        this.needAuth();
        this.send('+ idling');
        const timer = setInterval(() => {
          this.queue = this.queue.then(() => (this.idle && this.sel ? this.refresh(true) : null)).catch((e) => {
            if (e instanceof AuthError) { this.send('* BYE Session expired'); this.end(); } else this.log('warn', `idle poll: ${e.message}`);
          });
        }, this.pollMs);
        this.idle = { tag, timer };
        return;
      }
      default: throw new Bad(`Unknown command ${ascii(cmd)}`);
    }
  }

  ok(tag, text) { this.send(`${tag} OK ${text}`); }

  // ---------- 登录 ----------
  starttls(tag) {
    if (this.secure) throw new Bad('TLS already active');
    if (!this.secureContext()) throw new No('TLS not available');
    this.ok(tag, 'Begin TLS negotiation now');
    const raw = this.sock;
    raw.removeAllListeners('data'); raw.removeAllListeners('close'); raw.removeAllListeners('error'); raw.setTimeout(0);
    const t = new tls.TLSSocket(raw, { isServer: true, secureContext: this.secureContext() });
    this.secure = true;
    this.buf = Buffer.alloc(0);
    this.attach(t);
  }

  async saslPlain(tag, b64) {
    const parts = Buffer.from(b64, 'base64').toString('utf8').split('\0');
    if (parts.length !== 3) throw new Bad('Invalid SASL response');
    return this.login(tag, parts[1] || parts[0], parts[2]);
  }

  async login(tag, address, password) {
    if (this.user) throw new Bad('Already logged in');
    if (!this.secure && !this.allowPlainLogin) throw new No('[PRIVACYREQUIRED] Use STARTTLS first');
    const addr = String(address || '').trim().toLowerCase();
    const key = crypto.createHash('sha256').update(`${addr}\0${password}`).digest('hex');
    let hit = loginCache.get(key);
    if (!hit || hit.at < Date.now() - 10 * 60 * 1000) {
      try {
        const r = await this.api.login(addr, password, this.ip, this.clientId);
        hit = { token: r.token, address: r.address, at: Date.now() };
        loginCache.set(key, hit);
      } catch (e) {
        loginCache.delete(key);
        if (e instanceof ApiError && e.status === 429) throw new No('[LIMIT] Too many failed attempts, try again in 15 minutes');
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          this.log('info', `login failed ${addr} from ${this.ip}`);
          throw new No('[AUTHENTICATIONFAILED] Invalid credentials');
        }
        throw e;
      }
    }
    this.user = hit.address; this.token = hit.token; this.loginKey = key;
    this.log('info', `login ${this.user} from ${this.ip}${this.clientId ? ' (' + this.clientId + ')' : ''}`);
    this.ok(tag, `[CAPABILITY ${this.caps()}] Logged in`);
  }

  // 令牌失效(改密码、停用账号)时，把缓存也清掉
  async call(fn) {
    try { return await fn(this.token); } catch (e) {
      if (e instanceof AuthError) loginCache.delete(this.loginKey);
      throw e;
    }
  }

  // ---------- 带缓存的读取 ----------
  async boxEntry() {
    const { v } = await this.call((t) => this.api.ver(t));
    let c = boxCache.get(this.user);
    if (!c || c.v !== v) { c = { v, folders: null, lists: new Map() }; boxCache.set(this.user, c); }
    return c;
  }
  async getList(folder) {
    const c = await this.boxEntry();
    let l = c.lists.get(folder);
    if (!l) { l = await this.call((t) => this.api.list(t, folder)); if (l.v === c.v) c.lists.set(folder, l); }
    return l;
  }
  async getFolders() {
    const c = await this.boxEntry();
    if (c.folders) return c.folders;
    const r = await this.call((t) => this.api.folders(t));
    if (r.v === c.v) c.folders = r;
    return r;
  }

  // ---------- 文件夹 ----------
  async list(tag, cmd, a) {
    let args = a;
    let specialOnly = false;
    if (Array.isArray(args[0])) { specialOnly = args[0].map(str).some((x) => /^SPECIAL-USE$/i.test(x)); args = args.slice(1); }
    const ref = str(args[0]);
    const pats = Array.isArray(args[1]) ? args[1].map(str) : [str(args[1])];
    const resp = cmd === 'LSUB' ? 'LSUB' : cmd === 'XLIST' ? 'XLIST' : 'LIST';
    if (pats.length === 1 && pats[0] === '') { this.send(`* ${resp} (\\Noselect) "/" ""`); return this.ok(tag, `${cmd} completed`); }
    const res = pats.map((p) => {
      const full = ref + p;
      return new RegExp('^' + full.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/%/g, '[^/]*') + '$', 'i');
    });
    for (const f of FOLDERS) {
      if (specialOnly && !f.use) continue;
      if (!res.some((r) => r.test(f.name))) continue;
      const attrs = ['\\HasNoChildren'];
      if (f.use) attrs.push(f.use);
      if (resp === 'XLIST' && f.f === 'inbox') attrs.push('\\Inbox');
      this.send(`* ${resp} (${attrs.join(' ')}) "/" ${nstr(f.name)}`);
    }
    this.ok(tag, `${cmd} completed`);
  }

  async status(tag, a) {
    const f = findFolder(str(a[0]));
    if (!f) throw new No('[NONEXISTENT] No such mailbox');
    const items = (Array.isArray(a[1]) ? a[1] : []).map((x) => str(x).toUpperCase());
    const r = await this.getFolders();
    const c = r.folders[f.f] || { total: 0, unseen: 0 };
    const out = [];
    for (const it of items) {
      if (it === 'MESSAGES') out.push(`MESSAGES ${c.total}`);
      else if (it === 'RECENT') out.push('RECENT 0');
      else if (it === 'UIDNEXT') out.push(`UIDNEXT ${r.uidnext}`);
      else if (it === 'UIDVALIDITY') out.push(`UIDVALIDITY ${r.uidvalidity}`);
      else if (it === 'UNSEEN') out.push(`UNSEEN ${c.unseen}`);
    }
    this.send(`* STATUS ${nstr(f.name)} (${out.join(' ')})`);
    this.ok(tag, 'STATUS completed');
  }

  async select(tag, name, ro) {
    this.sel = null;
    const f = findFolder(name);
    if (!f) throw new No('[NONEXISTENT] No such mailbox');
    const r = await this.getList(f.f);
    this.sel = { ...f, ro, uids: r.items.map((x) => x[0]), info: new Map(r.items.map((x) => [x[0], { flags: x[1], size: x[2], date: x[3] }])), validity: r.uidvalidity, next: r.uidnext };
    const firstUnseen = this.sel.uids.findIndex((u) => !(this.sel.info.get(u).flags & SEEN));
    this.send('* FLAGS (\\Seen \\Flagged \\Deleted \\Answered \\Draft)');
    this.send(`* OK [PERMANENTFLAGS (${ro ? '' : '\\Seen \\Flagged \\Deleted \\Answered \\*'})] Flags permitted`);
    this.send(`* ${this.sel.uids.length} EXISTS`);
    this.send('* 0 RECENT');
    if (firstUnseen >= 0) this.send(`* OK [UNSEEN ${firstUnseen + 1}] First unseen`);
    this.send(`* OK [UIDVALIDITY ${r.uidvalidity}] UIDs valid`);
    this.send(`* OK [UIDNEXT ${r.uidnext}] Predicted next UID`);
    this.ok(tag, `[${ro ? 'READ-ONLY' : 'READ-WRITE'}] ${ro ? 'EXAMINE' : 'SELECT'} completed`);
  }

  // 重新拉一遍文件夹，对比后发 EXPUNGE / EXISTS / FETCH FLAGS
  async refresh(notify) {
    const sel = this.sel;
    const r = await this.getList(sel.f);
    if (this.sel !== sel) return;
    const now = new Map(r.items.map((x) => [x[0], { flags: x[1], size: x[2], date: x[3] }]));
    for (let i = sel.uids.length - 1; i >= 0; i--) {
      const u = sel.uids[i];
      if (!now.has(u)) {
        sel.uids.splice(i, 1); sel.info.delete(u);
        extraFlags.delete(flagKey(this.user, sel.f, u));
        if (notify) this.send(`* ${i + 1} EXPUNGE`);
      }
    }
    sel.uids.forEach((u, i) => {
      const old = sel.info.get(u), cur = now.get(u);
      if (old.flags !== cur.flags) { old.flags = cur.flags; if (notify) this.send(`* ${i + 1} FETCH (UID ${u} FLAGS (${this.flagsOf(u).join(' ')}))`); }
      old.size = cur.size;
    });
    const known = new Set(sel.uids);
    const added = r.items.filter((x) => !known.has(x[0]));
    if (added.length) {
      for (const x of added) { sel.uids.push(x[0]); sel.info.set(x[0], now.get(x[0])); }
      sel.uids.sort((a, b) => a - b);
      if (notify) { this.send(`* ${sel.uids.length} EXISTS`); this.send('* 0 RECENT'); }
    }
    sel.next = r.uidnext;
  }

  flagsOf(u) {
    const sel = this.sel, inf = sel.info.get(u);
    const out = [];
    if (inf.flags & SEEN) out.push('\\Seen');
    if (inf.flags & STAR) out.push('\\Flagged');
    if (sel.f === 'drafts') out.push('\\Draft');
    for (const x of extraFlags.get(flagKey(this.user, sel.f, u)) || []) out.push(x);
    return out;
  }

  // 序号或 UID 集合 → [{seq, uid}]
  targets(setStr, uid) {
    const sel = this.sel;
    if (uid) {
      const max = sel.uids.length ? sel.uids[sel.uids.length - 1] : 0;
      const p = parseSet(setStr, max);
      return sel.uids.map((u, i) => ({ seq: i + 1, uid: u })).filter((x) => p(x.uid));
    }
    const p = parseSet(setStr, sel.uids.length);
    return sel.uids.map((u, i) => ({ seq: i + 1, uid: u })).filter((x) => p(x.seq));
  }
  uidPred(setStr) {
    const max = this.sel.uids.length ? this.sel.uids[this.sel.uids.length - 1] : 0;
    return parseSet(setStr, max);
  }

  // ---------- FETCH ----------
  parseFetchItems(a) {
    let items = Array.isArray(a) ? a.map(str) : [str(a)];
    const up = items.map((x) => x.toUpperCase());
    if (up.length === 1 && up[0] === 'ALL') items = ['FLAGS', 'INTERNALDATE', 'RFC822.SIZE', 'ENVELOPE'];
    else if (up.length === 1 && up[0] === 'FAST') items = ['FLAGS', 'INTERNALDATE', 'RFC822.SIZE'];
    else if (up.length === 1 && up[0] === 'FULL') items = ['FLAGS', 'INTERNALDATE', 'RFC822.SIZE', 'ENVELOPE', 'BODY'];
    return items.map((raw) => {
      const m = raw.match(/^(BODY(?:\.PEEK)?)\[([^\]]*)\](?:<(\d+)(?:\.(\d+))?>)?$/i);
      if (!m) return { kind: raw.toUpperCase() };
      const secRaw = m[2];
      const sm = secRaw.match(/^((?:\d+\.)*\d+)?\.?(HEADER\.FIELDS\.NOT|HEADER\.FIELDS|HEADER|TEXT|MIME)?\s*(?:\((.*)\))?$/i);
      if (!sm) throw new Bad('Invalid section');
      const sec = { path: sm[1] ? sm[1].split('.').map(Number) : [], spec: (sm[2] || '').toUpperCase(), fields: sm[3] ? sm[3].trim().split(/\s+/).map((x) => x.replace(/^"|"$/g, '')) : [] };
      return {
        kind: 'BODY[]', peek: /PEEK/i.test(m[1]), sec,
        label: `BODY[${sec.path.join('.')}${sec.path.length && sec.spec ? '.' : ''}${sec.spec}${sec.fields.length ? ' (' + sec.fields.map((f) => f.toUpperCase()).join(' ') + ')' : ''}]`,
        start: m[3] !== undefined ? Number(m[3]) : null, len: m[4] !== undefined ? Number(m[4]) : null,
      };
    });
  }

  async loadRaw(uid) {
    const key = `${this.user}|${this.sel.f}|${uid}`;
    let e = rawCache.get(key);
    if (!e) {
      const buf = toCRLF(await this.call((t) => this.api.raw(t, this.sel.f, uid)));
      const s = buf.toString('latin1');
      e = { s, root: parseMessage(s) };
      cacheRaw(key, e);
      const inf = this.sel.info.get(uid);
      if (inf) inf.size = s.length;
    }
    return e;
  }

  async fetch(tag, a, uid) {
    const list = this.targets(str(a[0]), uid);
    const items = this.parseFetchItems(a[1]);
    if (uid && !items.some((x) => x.kind === 'UID')) items.unshift({ kind: 'UID' });
    // 只要信头就批量取信头；要正文或结构就取整封
    const headerOnly = (it) => it.kind === 'ENVELOPE' || it.kind === 'RFC822.HEADER' || (it.kind === 'BODY[]' && !it.sec.path.length && it.sec.spec.startsWith('HEADER'));
    const needRaw = items.some((it) => ['BODYSTRUCTURE', 'BODY', 'RFC822', 'RFC822.TEXT'].includes(it.kind) || (it.kind === 'BODY[]' && !headerOnly(it)));
    const needHead = !needRaw && items.some(headerOnly);
    const markSeen = !this.sel.ro && items.some((it) => it.kind === 'RFC822' || it.kind === 'RFC822.TEXT' || (it.kind === 'BODY[]' && !it.peek));
    const toSee = [];
    if (markSeen) for (const t of list) { const inf = this.sel.info.get(t.uid); if (!(inf.flags & SEEN)) { inf.flags |= SEEN; toSee.push(t.uid); } }
    if (toSee.length) await this.call((tk) => this.api.flags(tk, this.sel.f, toSee, { seen: true }));

    const heads = new Map();
    if (needHead) {
      for (let i = 0; i < list.length; i += 50) {
        const chunk = list.slice(i, i + 50).map((x) => x.uid);
        const r = await this.call((t) => this.api.headers(t, this.sel.f, chunk));
        for (const [k, v] of Object.entries(r.items)) heads.set(Number(k), toCRLF(Buffer.from(v, 'latin1')).toString('latin1'));
      }
    }
    const lit = (s) => `{${s.length}}\r\n${s}`;
    for (const t of list) {
      const inf = this.sel.info.get(t.uid);
      if (!inf) continue;
      let raw = null;
      if (needRaw) {
        try { raw = await this.loadRaw(t.uid); } catch (e) { if (e instanceof ApiError && e.status === 404) continue; throw e; }
      }
      const head = raw ? raw.s.slice(0, raw.root.headerEnd) : heads.get(t.uid);
      if (needHead && head === undefined) continue;
      const out = [];
      const flagsSent = { v: false };
      for (const it of items) {
        switch (it.kind) {
          case 'UID': out.push(`UID ${t.uid}`); break;
          case 'FLAGS': out.push(`FLAGS (${this.flagsOf(t.uid).join(' ')})`); flagsSent.v = true; break;
          case 'INTERNALDATE': out.push(`INTERNALDATE ${imapDate(inf.date)}`); break;
          case 'RFC822.SIZE': out.push(`RFC822.SIZE ${raw ? raw.s.length : inf.size}`); break;
          case 'ENVELOPE': out.push(`ENVELOPE ${envelope(headerFields(head))}`); break;
          case 'BODYSTRUCTURE': out.push(`BODYSTRUCTURE ${bodyStructure(raw.s, raw.root, true)}`); break;
          case 'BODY': out.push(`BODY ${bodyStructure(raw.s, raw.root, false)}`); break;
          case 'RFC822': out.push(`RFC822 ${lit(raw.s)}`); break;
          case 'RFC822.HEADER': out.push(`RFC822.HEADER ${lit(head)}`); break;
          case 'RFC822.TEXT': out.push(`RFC822.TEXT ${lit(raw.s.slice(raw.root.bodyStart))}`); break;
          case 'BODY[]': {
            let s = raw ? sectionText(raw.s, raw.root, it.sec) : sectionText(head, parseMessage(head), it.sec);
            let label = it.label;
            if (it.start !== null) { s = s.slice(it.start, it.len !== null ? it.start + it.len : undefined); label += `<${it.start}>`; }
            out.push(`${label} ${lit(s)}`);
            break;
          }
          default: throw new Bad(`Unknown fetch item ${ascii(it.kind)}`);
        }
      }
      if (toSee.includes(t.uid) && !flagsSent.v) out.push(`FLAGS (${this.flagsOf(t.uid).join(' ')})`);
      this.send(`* ${t.seq} FETCH (${out.join(' ')})`);
    }
    this.ok(tag, `${uid ? 'UID ' : ''}FETCH completed`);
  }

  // ---------- STORE ----------
  async store(tag, a, uid) {
    const list = this.targets(str(a[0]), uid);
    if (this.sel.ro) throw new No('Mailbox is read-only');
    const op = str(a[1]).toUpperCase();
    const m = op.match(/^([+-]?)FLAGS(\.SILENT)?$/);
    if (!m) throw new Bad('Invalid STORE item');
    const flags = (Array.isArray(a[2]) ? a[2] : a.slice(2)).map(str).filter(Boolean);
    const has = (f) => flags.some((x) => x.toLowerCase() === f.toLowerCase());
    const others = flags.filter((x) => !/^\\(seen|flagged|recent|draft)$/i.test(x));
    const setSeen = [], unSeen = [], setStar = [], unStar = [];
    for (const t of list) {
      const inf = this.sel.info.get(t.uid);
      const cur = { seen: !!(inf.flags & SEEN), star: !!(inf.flags & STAR) };
      const want = { ...cur };
      if (m[1] === '') { want.seen = has('\\Seen'); want.star = has('\\Flagged'); }
      if (m[1] === '+') { if (has('\\Seen')) want.seen = true; if (has('\\Flagged')) want.star = true; }
      if (m[1] === '-') { if (has('\\Seen')) want.seen = false; if (has('\\Flagged')) want.star = false; }
      if (want.seen !== cur.seen) (want.seen ? setSeen : unSeen).push(t.uid);
      if (want.star !== cur.star) (want.star ? setStar : unStar).push(t.uid);
      inf.flags = (want.seen ? SEEN : 0) | (want.star ? STAR : 0);
      const k = flagKey(this.user, this.sel.f, t.uid);
      const ex = new Set(m[1] === '' ? [] : extraFlags.get(k) || []);
      for (const f of others) m[1] === '-' ? ex.delete(f) : ex.add(f);
      if (ex.size) extraFlags.set(k, ex); else extraFlags.delete(k);
    }
    const f = this.sel.f;
    if (setSeen.length) await this.call((t) => this.api.flags(t, f, setSeen, { seen: true }));
    if (unSeen.length) await this.call((t) => this.api.flags(t, f, unSeen, { seen: false }));
    if (setStar.length) await this.call((t) => this.api.flags(t, f, setStar, { starred: true }));
    if (unStar.length) await this.call((t) => this.api.flags(t, f, unStar, { starred: false }));
    if (!m[2]) for (const t of list) this.send(`* ${t.seq} FETCH (${uid ? `UID ${t.uid} ` : ''}FLAGS (${this.flagsOf(t.uid).join(' ')}))`);
    this.ok(tag, `${uid ? 'UID ' : ''}STORE completed`);
  }

  // ---------- EXPUNGE ----------
  async expunge(pred, silent = false) {
    const sel = this.sel;
    const del = sel.uids.filter((u) => (extraFlags.get(flagKey(this.user, sel.f, u)) || new Set()).has('\\Deleted') && (!pred || pred(u)));
    if (del.length) await this.call((t) => this.api.expunge(t, sel.f, del));
    for (let i = sel.uids.length - 1; i >= 0; i--) {
      const u = sel.uids[i];
      if (!del.includes(u)) continue;
      sel.uids.splice(i, 1); sel.info.delete(u); extraFlags.delete(flagKey(this.user, sel.f, u));
      if (!silent) this.send(`* ${i + 1} EXPUNGE`);
    }
  }

  // ---------- COPY / MOVE ----------
  // OneMail 里一封信只在一个文件夹，所以 COPY 也是移动(复制到星标 = 加星标)
  async copy(tag, a, uid, isMove) {
    const list = this.targets(str(a[0]), uid);
    const dest = findFolder(str(a[1]));
    if (!dest) throw new No('[TRYCREATE] No such mailbox');
    if (this.sel.ro && isMove) throw new No('Mailbox is read-only');
    if (!list.length) return this.ok(tag, `${isMove ? 'MOVE' : 'COPY'} completed`);
    if (dest.f === this.sel.f) throw new No('[CANNOT] Source and destination are the same');
    const r = await this.call((t) => this.api.move(t, this.sel.f, list.map((x) => x.uid), dest.f));
    const map = r.map.filter((x) => x[1]);
    const code = map.length ? `[COPYUID ${this.sel.validity} ${map.map((x) => x[0]).join(',')} ${map.map((x) => x[1]).join(',')}] ` : '';
    if (isMove) {
      if (code) this.send(`* OK ${code}Moved`);
      await this.refresh(true);
      return this.ok(tag, `${uid ? 'UID ' : ''}MOVE completed`);
    }
    await this.refresh(true);
    this.ok(tag, `${code}${uid ? 'UID ' : ''}COPY completed`);
  }

  // ---------- APPEND ----------
  async append(tag, a) {
    const f = findFolder(str(a[0]));
    if (!f) throw new No('[TRYCREATE] No such mailbox');
    let i = 1, flags = [], date = 0;
    if (Array.isArray(a[i])) flags = a[i++].map(str);
    if (!(a[i] instanceof Lit) && a[i] !== undefined) date = parseAppendDate(str(a[i++]));
    const msg = a[i];
    if (!(msg instanceof Lit)) throw new Bad('Message literal expected');
    const fl = (x) => flags.some((y) => y.toLowerCase() === x);
    const r = await this.call((t) => this.api.append(t, f.f, msg.buf, { seen: fl('\\seen') ? 1 : 0, starred: fl('\\flagged') ? 1 : 0, date: date || '' }));
    if (this.sel && (this.sel.f === f.f || (f.f === 'inbox' && this.sel.f === 'starred'))) await this.refresh(true);
    this.ok(tag, `[APPENDUID ${r.uidvalidity} ${r.uid}] APPEND completed`);
  }

  // ---------- SEARCH ----------
  async search(tag, a, uid) {
    let args = a;
    if (str(args[0]).toUpperCase() === 'CHARSET') args = args.slice(2);
    const sel = this.sel;
    const all = sel.uids.map((u, i) => ({ seq: i + 1, uid: u }));
    const needMeta = { v: false }, needHead = { v: false };
    let pos = 0;
    const parseKey = (toks) => {
      const t = toks[pos++];
      if (Array.isArray(t)) { const save = pos; pos = 0; const sub = parseAll(t); pos = save; return sub; }
      const k = str(t).toUpperCase();
      const arg = () => { if (pos >= toks.length) throw new Bad('Missing search argument'); return toks[pos++]; };
      const flag = (f, want) => (m) => this.flagsOf(m.uid).includes(f) === want;
      const text = (field) => { const v = utf8(arg()).toLowerCase(); needMeta.v = true; return (m) => (field(m.meta) || '').toLowerCase().includes(v); };
      const dateCmp = (fn) => { const d = parseSearchDate(str(arg())); if (d === null) throw new Bad('Invalid date'); return (m) => fn(Math.floor(sel.info.get(m.uid).date / 86400000) * 86400000, d); };
      switch (k) {
        case 'ALL': case 'OLD': return () => true;
        case 'NEW': case 'RECENT': return k === 'NEW' ? flag('\\Seen', false) : () => false;
        case 'SEEN': return flag('\\Seen', true);
        case 'UNSEEN': return flag('\\Seen', false);
        case 'FLAGGED': return flag('\\Flagged', true);
        case 'UNFLAGGED': return flag('\\Flagged', false);
        case 'DELETED': return flag('\\Deleted', true);
        case 'UNDELETED': return flag('\\Deleted', false);
        case 'ANSWERED': return flag('\\Answered', true);
        case 'UNANSWERED': return flag('\\Answered', false);
        case 'DRAFT': return flag('\\Draft', true);
        case 'UNDRAFT': return flag('\\Draft', false);
        case 'KEYWORD': { const kw = str(arg()); return flag(kw, true); }
        case 'UNKEYWORD': { const kw = str(arg()); return flag(kw, false); }
        case 'BEFORE': case 'SENTBEFORE': return dateCmp((d, x) => d < x);
        case 'ON': case 'SENTON': return dateCmp((d, x) => d === x);
        case 'SINCE': case 'SENTSINCE': return dateCmp((d, x) => d >= x);
        case 'LARGER': { const n = Number(str(arg())); return (m) => sel.info.get(m.uid).size > n; }
        case 'SMALLER': { const n = Number(str(arg())); return (m) => sel.info.get(m.uid).size < n; }
        case 'UID': { const p = this.uidPred(str(arg())); return (m) => p(m.uid); }
        case 'FROM': return text((x) => x?.from);
        case 'TO': return text((x) => x?.to);
        case 'CC': case 'BCC': return text((x) => x?.cc);
        case 'SUBJECT': return text((x) => x?.subject);
        case 'BODY': return text((x) => x?.text);
        case 'TEXT': return text((x) => x && `${x.subject} ${x.from} ${x.to} ${x.cc} ${x.text}`);
        case 'HEADER': {
          const name = str(arg()).toLowerCase(), v = utf8(arg()).toLowerCase();
          needHead.v = true;
          return (m) => headerFields(m.head || '').some((f) => f.name === name && f.value.toLowerCase().includes(v));
        }
        case 'NOT': { const f = parseKey(toks); return (m) => !f(m); }
        case 'OR': { const x = parseKey(toks), y = parseKey(toks); return (m) => x(m) || y(m); }
        default: {
          if (/^[\d*:,]+$/.test(k)) { const p = parseSet(k, sel.uids.length); return (m) => p(m.seq); }
          throw new Bad(`Unsupported search key ${ascii(k)}`);
        }
      }
    };
    const parseAll = (toks) => { const fs = []; while (pos < toks.length) fs.push(parseKey(toks)); return (m) => fs.every((f) => f(m)); };
    const pred = parseAll(args);
    if (needMeta.v) {
      const r = await this.call((t) => this.api.meta(t, sel.f));
      const map = new Map(r.items.map((x) => [x.uid, x]));
      for (const m of all) m.meta = map.get(m.uid);
    }
    if (needHead.v) {
      for (let i = 0; i < all.length; i += 50) {
        const chunk = all.slice(i, i + 50);
        const r = await this.call((t) => this.api.headers(t, sel.f, chunk.map((x) => x.uid)));
        for (const m of chunk) m.head = r.items[m.uid] ? toCRLF(Buffer.from(r.items[m.uid], 'latin1')).toString('latin1') : '';
      }
    }
    const hits = all.filter(pred).map((m) => (uid ? m.uid : m.seq));
    this.send(`* SEARCH${hits.length ? ' ' + hits.join(' ') : ''}`);
    this.ok(tag, `${uid ? 'UID ' : ''}SEARCH completed`);
  }
}

// 协议里的说明文字只用 ASCII
function ascii(s) { return String(s || '').replace(/[^\x20-\x7e]/g, '?').slice(0, 200); }

export { compactSet };
