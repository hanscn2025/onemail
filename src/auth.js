// 密码哈希、会话 cookie、登录限速
const enc = new TextEncoder();
const ITER = 100000; // Workers 的 PBKDF2 上限

const b64u = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function pbkdf2(password, salt, iter) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITER}$${b64u(salt)}$${b64u(await pbkdf2(password, salt, ITER))}`;
}

export async function verifyPassword(password, stored) {
  const [kind, iter, salt, hash] = String(stored).split('$');
  if (kind !== 'pbkdf2') return false;
  return timingSafeEqual(b64u(await pbkdf2(password, unb64u(salt), Number(iter))), hash);
}

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

const COOKIE = 'cfmail_s';
const TTL = 30 * 24 * 3600;

export async function makeSessionCookie(env, user) {
  const payload = b64u(enc.encode(JSON.stringify({ u: user.id, v: user.session_ver, e: Math.floor(Date.now() / 1000) + TTL })));
  const sig = await hmac(env.SESSION_SECRET, payload);
  return `${COOKIE}=${payload}.${sig}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${TTL}`;
}

export const clearCookie = `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

export async function getSessionUser(request, env) {
  if (!env.SESSION_SECRET) throw new Error('SESSION_SECRET 未设置');
  const m = (request.headers.get('Cookie') || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return null;
  const [payload, sig] = m[1].split('.');
  if (!payload || !sig || !timingSafeEqual(await hmac(env.SESSION_SECRET, payload), sig)) return null;
  let p;
  try {
    p = JSON.parse(new TextDecoder().decode(unb64u(payload)));
  } catch {
    return null;
  }
  if (!p.e || p.e < Date.now() / 1000) return null;
  const user = await env.DB.prepare('SELECT id, address, name, is_admin, session_ver FROM users WHERE id = ?').bind(p.u).first();
  if (!user || user.session_ver !== p.v) return null;
  return user;
}

// 同一 IP 或同一账号连续失败 5 次,锁 15 分钟
const MAX_FAIL = 5;
const LOCK_MS = 15 * 60 * 1000;

export async function checkLocked(env, keys) {
  const now = Date.now();
  for (const k of keys) {
    const r = await env.DB.prepare('SELECT count, until FROM login_fail WHERE key = ?').bind(k).first();
    if (r && r.count >= MAX_FAIL && r.until > now) return true;
  }
  return false;
}

export async function recordFail(env, keys) {
  const now = Date.now();
  for (const k of keys) {
    await env.DB.prepare(
      `INSERT INTO login_fail (key, count, until) VALUES (?1, 1, ?2)
       ON CONFLICT(key) DO UPDATE SET count = CASE WHEN until < ?3 THEN 1 ELSE count + 1 END, until = ?2`
    ).bind(k, now + LOCK_MS, now).run();
  }
}

export async function clearFail(env, keys) {
  for (const k of keys) await env.DB.prepare('DELETE FROM login_fail WHERE key = ?').bind(k).run();
}
