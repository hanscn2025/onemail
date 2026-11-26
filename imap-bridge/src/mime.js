// 邮件结构解析：BODYSTRUCTURE、ENVELOPE、按段取内容。
// 全程用 latin1 字符串(一个字符 = 一个字节),输出时再 Buffer.from(s, 'latin1') 还原，不会改动原始字节。

// 统一换行为 CRLF(IMAP 要求)
export function toCRLF(buf) {
  let lone = 0;
  for (let i = 0; i < buf.length; i++) if (buf[i] === 10 && (i === 0 || buf[i - 1] !== 13)) lone++;
  if (!lone) return buf;
  const out = Buffer.allocUnsafe(buf.length + lone);
  let j = 0;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 10 && (i === 0 || buf[i - 1] !== 13)) out[j++] = 13;
    out[j++] = buf[i];
  }
  return out;
}

// 信头块拆成字段(保留原样，含折行)
export function headerFields(block) {
  const lines = block.split('\r\n');
  const out = [];
  for (const l of lines) {
    if (!l) continue;
    if (/^[ \t]/.test(l) && out.length) out[out.length - 1].raw += '\r\n' + l;
    else {
      const i = l.indexOf(':');
      out.push({ name: (i > 0 ? l.slice(0, i) : l).trim().toLowerCase(), raw: l });
    }
  }
  for (const f of out) {
    const i = f.raw.indexOf(':');
    f.value = i < 0 ? '' : f.raw.slice(i + 1).replace(/\r\n[ \t]+/g, ' ').trim();
  }
  return out;
}

const hget = (fields, name) => fields.find((f) => f.name === name)?.value ?? null;

// Content-Type 之类带参数的头：主值 + 参数表
function parseParams(v) {
  const out = { value: '', params: [] };
  if (!v) return out;
  let i = 0;
  const readUntil = (stop) => {
    let s = '';
    while (i < v.length && !stop.includes(v[i])) {
      if (v[i] === '"') {
        i++;
        while (i < v.length && v[i] !== '"') { if (v[i] === '\\') i++; s += v[i++] ?? ''; }
        i++;
      } else s += v[i++];
    }
    return s.trim();
  };
  out.value = readUntil(';').toLowerCase();
  while (i < v.length) {
    i++; // ;
    const k = readUntil('=;').toLowerCase();
    if (v[i] === '=') { i++; const val = readUntil(';'); if (k) out.params.push([k, val]); }
    else if (k) out.params.push([k, '']);
  }
  return out;
}

// 解析一段(信本身或 multipart 里的一部分):start..end 是这段在原文里的位置
export function parsePart(s, start, end, defType = 'text/plain') {
  let headerEnd, bodyStart;
  if (s.startsWith('\r\n', start)) { headerEnd = start + 2; bodyStart = start + 2; }
  else {
    const i = s.indexOf('\r\n\r\n', start);
    if (i < 0 || i + 4 > end) { headerEnd = end; bodyStart = end; }
    else { headerEnd = i + 4; bodyStart = i + 4; }
  }
  const fields = headerFields(s.slice(start, Math.min(headerEnd, end)));
  const ct = parseParams(hget(fields, 'content-type') || defType);
  let [type, subtype] = (ct.value || defType).split('/');
  if (!subtype) { type = 'text'; subtype = 'plain'; }
  const part = { start, headerEnd, bodyStart, end, fields, type, subtype, params: ct.params };
  if (type === 'multipart') {
    const boundary = ct.params.find((p) => p[0] === 'boundary')?.[1];
    const children = [];
    if (boundary) {
      const delim = '--' + boundary;
      let i = s.startsWith(delim, bodyStart) ? bodyStart : s.indexOf('\r\n' + delim, bodyStart);
      if (i >= 0 && i !== bodyStart) i += 2;
      while (i >= 0 && i < end) {
        if (s.startsWith('--', i + delim.length)) break;
        const ps = s.indexOf('\r\n', i);
        if (ps < 0 || ps >= end) break;
        let next = s.indexOf('\r\n' + delim, ps + 2);
        if (next < 0 || next > end) next = end;
        // 两个分隔线挨着时(空的一段)位置不会倒退
        children.push(parsePart(s, ps + 2, Math.max(ps + 2, next), subtype === 'digest' ? 'message/rfc822' : 'text/plain'));
        i = next + 2;
      }
    }
    if (children.length) part.children = children;
    else { part.type = 'text'; part.subtype = 'plain'; part.params = []; }
  } else if (type === 'message' && subtype === 'rfc822') {
    part.message = parsePart(s, bodyStart, end);
  }
  return part;
}

export function parseMessage(s) {
  return parsePart(s, 0, s.length);
}

// ---------- IMAP 字符串 ----------
export function nstr(v) {
  if (v === null || v === undefined) return 'NIL';
  const s = String(v);
  if (/^[\x20-\x7e]*$/.test(s) && s.length < 1000) return '"' + s.replace(/[\\"]/g, '\\$&') + '"';
  return `{${Buffer.byteLength(s, 'latin1')}}\r\n${s}`;
}
const q = nstr;

// ---------- 地址 ----------
function splitAddrs(v) {
  const out = [];
  let cur = '', inQ = false, ang = 0, par = 0;
  for (let i = 0; i < v.length; i++) {
    const c = v[i];
    if (inQ) { cur += c; if (c === '\\') cur += v[++i] ?? ''; else if (c === '"') inQ = false; continue; }
    if (c === '"') inQ = true;
    else if (c === '(') par++;
    else if (c === ')') par = Math.max(0, par - 1);
    else if (c === '<') ang++;
    else if (c === '>') ang = Math.max(0, ang - 1);
    if ((c === ',' || c === ';') && !ang && !par) { if (cur.trim()) out.push(cur.trim()); cur = ''; continue; }
    if (c === ':' && !ang && !par && !/@/.test(cur)) { cur = ''; continue; } // 群组名
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export function parseAddrs(v) {
  if (!v) return [];
  return splitAddrs(v).map((a) => {
    let name = null, addr = a;
    const m = a.match(/^(.*?)<([^>]*)>\s*(\(.*\))?$/);
    if (m) {
      name = m[1].trim().replace(/^"(.*)"$/, '$1').replace(/\\(.)/g, '$1') || null;
      addr = m[2].trim();
    } else {
      const c = a.match(/^(\S+)\s*\((.*)\)$/);
      if (c) { addr = c[1]; name = c[2] || null; }
    }
    const at = addr.lastIndexOf('@');
    return { name, mailbox: at < 0 ? addr : addr.slice(0, at), host: at < 0 ? null : addr.slice(at + 1) };
  }).filter((x) => x.mailbox);
}

const addrList = (v) => {
  const l = parseAddrs(v);
  return l.length ? '(' + l.map((a) => `(${q(a.name)} NIL ${q(a.mailbox)} ${q(a.host)})`).join('') + ')' : 'NIL';
};

export function envelope(fields) {
  const from = hget(fields, 'from');
  const sender = hget(fields, 'sender') || from;
  const replyTo = hget(fields, 'reply-to') || from;
  return `(${q(hget(fields, 'date'))} ${q(hget(fields, 'subject'))} ${addrList(from)} ${addrList(sender)} ${addrList(replyTo)} ${addrList(hget(fields, 'to'))} ${addrList(hget(fields, 'cc'))} ${addrList(hget(fields, 'bcc'))} ${q(hget(fields, 'in-reply-to'))} ${q(hget(fields, 'message-id'))})`;
}

// ---------- BODYSTRUCTURE / BODY ----------
const plist = (params) => (params.length ? '(' + params.map(([k, v]) => `${q(k.toUpperCase())} ${q(v)}`).join(' ') + ')' : 'NIL');

function disposition(part) {
  const d = parseParams(hget(part.fields, 'content-disposition'));
  return d.value ? `(${q(d.value.toUpperCase())} ${plist(d.params)})` : 'NIL';
}

export function bodyStructure(s, part, ext = true) {
  if (part.children) {
    return '(' + part.children.map((c) => bodyStructure(s, c, ext)).join('') + ` ${q(part.subtype.toUpperCase())}` +
      (ext ? ` ${plist(part.params)} ${disposition(part)} NIL NIL` : '') + ')';
  }
  const body = s.slice(part.bodyStart, part.end);
  const enc = (hget(part.fields, 'content-transfer-encoding') || '7BIT').toUpperCase();
  const params = part.type === 'text' && !part.params.some((p) => p[0] === 'charset') ? [['charset', 'us-ascii'], ...part.params] : part.params;
  let out = `${q(part.type.toUpperCase())} ${q(part.subtype.toUpperCase())} ${plist(params)} ${q(hget(part.fields, 'content-id'))} ${q(hget(part.fields, 'content-description'))} ${q(enc)} ${body.length}`;
  const lines = (body.match(/\r\n/g) || []).length;
  if (part.type === 'text') out += ` ${lines}`;
  else if (part.message) out += ` ${envelope(part.message.fields)} ${bodyStructure(s, part.message, ext)} ${lines}`;
  if (ext) out += ` NIL ${disposition(part)} NIL NIL`;
  return '(' + out + ')';
}

// ---------- 按段取内容：BODY[1.2.HEADER] 之类 ----------
function findPart(root, nums) {
  let cur = root;
  for (const n of nums) {
    if (cur.message) cur = cur.message;
    if (cur.children) { cur = cur.children[n - 1]; if (!cur) return null; }
    else if (n !== 1) return null;
  }
  return cur;
}

export function filterHeaders(block, names, not) {
  const set = new Set(names.map((n) => n.toLowerCase()));
  return headerFields(block).filter((f) => set.has(f.name) !== !!not).map((f) => f.raw + '\r\n').join('') + '\r\n';
}

// section: { path: [1,2], spec: '' | 'HEADER' | 'TEXT' | 'MIME' | 'HEADER.FIELDS' | 'HEADER.FIELDS.NOT', fields: [] }
export function sectionText(s, root, sec) {
  let part = root;
  if (sec.path.length) { part = findPart(root, sec.path); if (!part) return ''; }
  if (!sec.spec) return sec.path.length ? s.slice(part.bodyStart, part.end) : s;
  if (sec.spec === 'MIME') return sec.path.length ? s.slice(part.start, part.headerEnd) : '';
  const msg = sec.path.length ? part.message : root;
  if (!msg) return '';
  const head = s.slice(msg.start, msg.headerEnd);
  if (sec.spec === 'HEADER') return head;
  if (sec.spec === 'TEXT') return s.slice(msg.bodyStart, msg.end);
  if (sec.spec === 'HEADER.FIELDS') return filterHeaders(head, sec.fields, false);
  if (sec.spec === 'HEADER.FIELDS.NOT') return filterHeaders(head, sec.fields, true);
  return '';
}
