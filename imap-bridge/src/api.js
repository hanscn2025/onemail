// 调 OneMail 的 /api/gw/* 接口。网关不存信，所有读写都走这里。
export class AuthError extends Error {}
export class ApiError extends Error {
  constructor(msg, status) { super(msg); this.status = status; }
}

export class OneMail {
  constructor(base, key) {
    this.base = base.replace(/\/+$/, '');
    this.key = key;
  }

  async req(method, path, { token, query, json, body, as = 'json' } = {}) {
    const u = new URL(this.base + '/api/gw' + path);
    for (const [k, v] of Object.entries(query || {})) if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
    const headers = { 'X-Gateway-Key': this.key, 'X-Mail': '1', 'User-Agent': 'onemail-imap-bridge' };
    if (token) headers.Authorization = 'Bearer ' + token;
    let payload = body;
    if (json) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(json); }
    if (body) headers['Content-Type'] = 'message/rfc822';
    let r;
    try {
      r = await fetch(u, { method, headers, body: payload, signal: AbortSignal.timeout(60000) });
    } catch (e) {
      throw new ApiError(`OneMail unreachable: ${e.cause?.code || e.message}`, 0);
    }
    if (r.status === 401 && token) throw new AuthError('session expired');
    // 后台停用了 IMAP 服务或换了密钥：断开已登录的连接
    if (r.status === 403 && token) throw new AuthError('gateway disabled');
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new ApiError(j.error || `HTTP ${r.status}`, r.status);
    }
    return as === 'buffer' ? Buffer.from(await r.arrayBuffer()) : r.json();
  }

  ping(info) { return this.req('POST', '/ping', { json: info }); }
  login(address, password, ip, clientId) { return this.req('POST', '/login', { json: { address, password, ip, client: clientId } }); }
  ver(token) { return this.req('GET', '/ver', { token }); }
  folders(token) { return this.req('GET', '/folders', { token }); }
  list(token, folder) { return this.req('GET', '/list', { token, query: { folder } }); }
  meta(token, folder, uids) { return this.req('GET', '/meta', { token, query: { folder, uids: uids ? uids.join(',') : '' } }); }
  headers(token, folder, uids) { return this.req('GET', '/headers', { token, query: { folder, uids: uids.join(',') } }); }
  raw(token, folder, uid) { return this.req('GET', '/raw', { token, query: { folder, uid }, as: 'buffer' }); }
  flags(token, folder, uids, change) { return this.req('POST', '/flags', { token, query: { folder }, json: { uids, ...change } }); }
  move(token, folder, uids, to) { return this.req('POST', '/move', { token, query: { folder }, json: { uids, to } }); }
  expunge(token, folder, uids) { return this.req('POST', '/expunge', { token, query: { folder }, json: { uids } }); }
  append(token, folder, raw, opts) { return this.req('POST', '/append', { token, query: { folder, ...opts }, body: raw }); }
}
