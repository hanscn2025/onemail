// 建表、读配置、首次设置
// 配置优先用 wrangler.toml 的 vars / secret(老部署方式);没有就读 D1 的 settings 表(网页一键部署后在首次设置页面填)。
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL DEFAULT '',
    pass_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    session_ver INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    mailbox TEXT NOT NULL,
    folder TEXT NOT NULL,
    prev_folder TEXT,
    message_id TEXT,
    in_reply_to TEXT,
    refs TEXT,
    envelope_to TEXT,
    from_addr TEXT NOT NULL DEFAULT '',
    from_name TEXT NOT NULL DEFAULT '',
    to_json TEXT NOT NULL DEFAULT '[]',
    cc_json TEXT NOT NULL DEFAULT '[]',
    reply_to TEXT,
    subject TEXT NOT NULL DEFAULT '',
    snippet TEXT NOT NULL DEFAULT '',
    attach_json TEXT NOT NULL DEFAULT '[]',
    has_attach INTEGER NOT NULL DEFAULT 0,
    size INTEGER NOT NULL DEFAULT 0,
    seen INTEGER NOT NULL DEFAULT 0,
    starred INTEGER NOT NULL DEFAULT 0,
    date INTEGER NOT NULL,
    moved_at INTEGER)`,
  `CREATE INDEX IF NOT EXISTS idx_msg_box ON messages(mailbox, folder, date DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_msg_trash ON messages(folder, moved_at)`,
  `CREATE TABLE IF NOT EXISTS login_fail (key TEXT PRIMARY KEY, count INTEGER NOT NULL, until INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
];

let schemaReady = false;
let cached = null;
let cachedAt = 0;
const CACHE_MS = 30_000; // 别的实例改了设置(比如填了发信 Key),最多 30 秒后这里也能读到

async function ensureSchema(env) {
  if (schemaReady) return;
  await env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s)));
  schemaReady = true;
}

const splitDomains = (s) => String(s || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);

async function loadConfig(env) {
  await ensureSchema(env);
  if (cached && Date.now() - cachedAt < CACHE_MS) return cached;
  const r = await env.DB.prepare('SELECT key, value FROM settings').all();
  const s = Object.fromEntries(r.results.map((x) => [x.key, x.value]));
  const cfg = {
    secret: env.SESSION_SECRET || s.secret || '',
    domains: env.DOMAINS !== undefined ? env.DOMAINS : s.domains || '',
    catchAll: env.CATCH_ALL !== undefined ? env.CATCH_ALL : s.catch_all || '',
    resendKey: env.RESEND_API_KEY || s.resend_key || '',
  };
  if (cfg.secret) { cached = cfg; cachedAt = Date.now(); } // 设置完成前不缓存,别的实例完成设置后这里能读到
  return cfg;
}

// 把配置叠到 env 上,其余代码继续用 env.SESSION_SECRET / env.DOMAINS / env.CATCH_ALL
export async function withConfig(env) {
  const cfg = await loadConfig(env);
  return Object.create(env, {
    SESSION_SECRET: { value: cfg.secret },
    DOMAINS: { value: cfg.domains },
    CATCH_ALL: { value: cfg.catchAll },
    RESEND_API_KEY: { value: cfg.resendKey },
  });
}

export async function getSetting(env, key) {
  const r = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
  return r ? r.value : null;
}

// value 为空就删除这项设置
export async function saveSetting(env, key, value) {
  if (value) await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(key, value).run();
  else await env.DB.prepare('DELETE FROM settings WHERE key = ?').bind(key).run();
  cached = null;
}

export function isConfigured(env) {
  return !!env.SESSION_SECRET;
}

const DOMAIN_RE = /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const LOCAL_RE = /^[a-z0-9._-]{1,64}$/;

// 首次设置:只有还没设置过时才能调用,谁先完成谁就是管理员
export async function runSetup(env, body, hashPassword) {
  const domain = String(body.domain || '').trim().toLowerCase().replace(/^@/, '');
  const local = String(body.user || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!DOMAIN_RE.test(domain)) return { error: '域名格式不对,例如 example.com' };
  if (!LOCAL_RE.test(local)) return { error: '用户名只能用小写字母、数字、点、横线、下划线' };
  if (password.length < 10) return { error: '密码至少 10 位' };
  const address = `${local}@${domain}`;
  const secret = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('');
  try {
    // 一个事务:第一条插入 setup_done,已经设置过就会因主键冲突整体失败
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO settings (key, value) VALUES ('setup_done', ?)`).bind(String(Date.now())),
      env.DB.prepare(`INSERT INTO settings (key, value) VALUES ('secret', ?), ('domains', ?), ('catch_all', ?)`).bind(secret, domain, address),
      env.DB.prepare('INSERT INTO users (address, name, pass_hash, is_admin, created_at) VALUES (?, ?, ?, 1, ?)')
        .bind(address, '', await hashPassword(password), Date.now()),
    ]);
  } catch {
    return { error: '已经设置过了,请直接登录', status: 409 };
  }
  cached = null;
  return { ok: true, address };
}
