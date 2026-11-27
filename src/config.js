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
  // 账号之外的地址：临时地址(temp)、别名(alias)、群组(group)
  `CREATE TABLE IF NOT EXISTS addresses (
    address TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    owner TEXT,
    members TEXT NOT NULL DEFAULT '[]',
    deliver INTEGER NOT NULL DEFAULT 1,
    fwd_to TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    expires_at INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    hits INTEGER NOT NULL DEFAULT 0,
    last_at INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_addr_owner ON addresses(owner, kind)`,
  // 登录、投递、转发、发信等记录
  `CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at INTEGER NOT NULL,
    kind TEXT NOT NULL,
    actor TEXT NOT NULL DEFAULT '',
    target TEXT NOT NULL DEFAULT '',
    detail TEXT NOT NULL DEFAULT '',
    ip TEXT NOT NULL DEFAULT '')`,
  `CREATE INDEX IF NOT EXISTS idx_logs_at ON logs(kind, at DESC)`,
  `CREATE TABLE IF NOT EXISTS autoreply_seen (key TEXT PRIMARY KEY, at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS tg_links (code TEXT PRIMARY KEY, user_id INTEGER NOT NULL, at INTEGER NOT NULL)`,
];

// 老数据库升级时补上的列
const USER_COLUMNS = {
  disabled: 'INTEGER NOT NULL DEFAULT 0',
  quota_mb: 'INTEGER NOT NULL DEFAULT 0',
  send_limit: 'INTEGER NOT NULL DEFAULT 0',
  signature: "TEXT NOT NULL DEFAULT ''",
  fwd_to: "TEXT NOT NULL DEFAULT ''",
  fwd_keep: 'INTEGER NOT NULL DEFAULT 1',
  fwd_mode: "TEXT NOT NULL DEFAULT 'cf'", // cf:Cloudflare 原样转发(需验证);send:用发信服务重新发出(免验证)
  ar_on: 'INTEGER NOT NULL DEFAULT 0',
  ar_subject: "TEXT NOT NULL DEFAULT ''",
  ar_body: "TEXT NOT NULL DEFAULT ''",
  ar_until: 'INTEGER NOT NULL DEFAULT 0',
  last_login: 'INTEGER NOT NULL DEFAULT 0',
  tg_chat: "TEXT NOT NULL DEFAULT ''",          // 绑定的 Telegram 聊天 id
  tg_body: 'INTEGER NOT NULL DEFAULT 1',        // 推送时带正文摘要
  tg_bulk: 'INTEGER NOT NULL DEFAULT 0',        // 群发、通知类邮件也推送
};
// auto=1:没提前建、第一次收到信时自动登记的地址，跟随兜底(默认)规则
const ADDR_COLUMNS = { auto: 'INTEGER NOT NULL DEFAULT 0' };

// IMAP 用的 UID:全库递增，新信、换文件夹、草稿重新保存时由触发器分配新值(IMAP 要求同一文件夹里只增不减、内容不变)
const UID_NEXT = '(SELECT COALESCE(MAX(uid), 0) + 1 FROM messages)';
const UID_SCHEMA = [
  `CREATE INDEX IF NOT EXISTS idx_msg_uid ON messages(uid)`,
  `CREATE INDEX IF NOT EXISTS idx_msg_box_uid ON messages(mailbox, uid)`,
  `CREATE TRIGGER IF NOT EXISTS trg_msg_uid_ins AFTER INSERT ON messages BEGIN
     UPDATE messages SET uid = ${UID_NEXT} WHERE id = NEW.id; END`,
  `CREATE TRIGGER IF NOT EXISTS trg_msg_uid_mv AFTER UPDATE OF folder, date ON messages
     WHEN OLD.folder != NEW.folder OR (NEW.folder = 'drafts' AND OLD.date != NEW.date) BEGIN
     UPDATE messages SET uid = ${UID_NEXT} WHERE id = NEW.id; END`,
  // 每个邮箱一个版本号，信件增删、已读星标变化时加一；IMAP 网关轮询时先看它，没变就不用重新读整个文件夹
  `CREATE TABLE IF NOT EXISTS mbox_ver (mailbox TEXT PRIMARY KEY, v INTEGER NOT NULL)`,
  `CREATE TRIGGER IF NOT EXISTS trg_ver_ins AFTER INSERT ON messages BEGIN
     INSERT INTO mbox_ver (mailbox, v) VALUES (NEW.mailbox, 1) ON CONFLICT(mailbox) DO UPDATE SET v = v + 1; END`,
  `CREATE TRIGGER IF NOT EXISTS trg_ver_del AFTER DELETE ON messages BEGIN
     INSERT INTO mbox_ver (mailbox, v) VALUES (OLD.mailbox, 1) ON CONFLICT(mailbox) DO UPDATE SET v = v + 1; END`,
  `CREATE TRIGGER IF NOT EXISTS trg_ver_upd AFTER UPDATE OF seen, starred, folder, uid ON messages BEGIN
     INSERT INTO mbox_ver (mailbox, v) VALUES (NEW.mailbox, 1) ON CONFLICT(mailbox) DO UPDATE SET v = v + 1; END`,
];

let schemaReady = false;
let cached = null;
let cachedAt = 0;
const CACHE_MS = 30_000; // 别的实例改了设置(比如填了发信 Key),最多 30 秒后这里也能读到

// IMAP 网关尚未正式发布:未开放前一律按未启用处理(后台开关置灰、客户端设置隐藏、网关接口拒绝)
export const IMAP_RELEASED = false;

let imapReady = false;
// 第一次打开 IMAP 服务时调用；之后每次冷启动由 ensureSchema 检查
export async function ensureImapSchema(env) {
  if (imapReady) return;
  const msgCols = new Set((await env.DB.prepare('PRAGMA table_info(messages)').all()).results.map((c) => c.name));
  if (!msgCols.has('uid')) {
    try { await env.DB.prepare('ALTER TABLE messages ADD COLUMN uid INTEGER').run(); } catch (e) {
      if (!/duplicate column/i.test(e.message)) throw e;
    }
  }
  // 老信按入库顺序编号(先编号再建触发器，之后的新信由触发器接着编);已编过号时没有空值，这句不改任何行
  await env.DB.prepare('UPDATE messages SET uid = rowid + (SELECT COALESCE(MAX(uid), 0) FROM messages) WHERE uid IS NULL').run();
  await env.DB.batch(UID_SCHEMA.map((s) => env.DB.prepare(s)));
  imapReady = true;
}

async function ensureSchema(env) {
  if (schemaReady) return;
  await env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s)));
  for (const [table, wanted] of [['users', USER_COLUMNS], ['addresses', ADDR_COLUMNS]]) {
    const cols = new Set((await env.DB.prepare(`PRAGMA table_info(${table})`).all()).results.map((c) => c.name));
    for (const [name, def] of Object.entries(wanted)) {
      if (cols.has(name)) continue;
      try { await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${def}`).run(); } catch (e) {
        if (!/duplicate column/i.test(e.message)) throw e; // 别的实例刚加过
      }
    }
  }
  // IMAP 用的 UID 和版本号：只有启用过 IMAP 服务的部署才建，没用这个功能的不受影响
  const on = await env.DB.prepare(`SELECT 1 FROM settings WHERE key = 'imap_on'`).first();
  if (on) await ensureImapSchema(env);
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
    catchAllOn: s.catch_all_off !== '1',       // 任意前缀收信,默认打开
    tgToken: s.tg_token || '',
    tgBot: s.tg_bot || '',
    tgSecret: s.tg_secret || '',
    appUrl: s.app_url || '',
    imapOn: IMAP_RELEASED && s.imap_on === '1',
    imapHost: s.imap_host || '',
    imapKey: s.imap_gw_key || '',
    catchAllLocked: env.CATCH_ALL !== undefined,
    // 转发服务:默认关闭;开启时必须有 Cloudflare API Token,用来自动提交目标地址
    fwdOn: s.fwd_on === '1' && !!s.cf_token && !!s.cf_account,
    cfToken: s.cf_token || '',
    cfAccount: s.cf_account || '',
  };
  if (cfg.secret) { cached = cfg; cachedAt = Date.now(); } // 设置完成前不缓存，别的实例完成设置后这里能读到
  return cfg;
}

// 把配置叠到 env 上，其余代码继续用 env.SESSION_SECRET / env.DOMAINS / env.CATCH_ALL
export async function withConfig(env) {
  const cfg = await loadConfig(env);
  return Object.create(env, {
    SESSION_SECRET: { value: cfg.secret },
    DOMAINS: { value: cfg.domains },
    CATCH_ALL: { value: cfg.catchAll },
    RESEND_API_KEY: { value: cfg.resendKey },
    CATCH_ALL_ON: { value: cfg.catchAllOn },
    TG_TOKEN: { value: cfg.tgToken },
    TG_BOT: { value: cfg.tgBot },
    TG_SECRET: { value: cfg.tgSecret },
    APP_URL: { value: cfg.appUrl },
    IMAP_ON: { value: cfg.imapOn },
    IMAP_HOST: { value: cfg.imapHost },
    IMAP_KEY: { value: cfg.imapKey },
    CATCH_ALL_LOCKED: { value: cfg.catchAllLocked },
    FWD_ON: { value: cfg.fwdOn },
    CF_TOKEN: { value: cfg.cfToken },
    CF_ACCOUNT: { value: cfg.cfAccount },
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

// 首次设置：只有还没设置过时才能调用，谁先完成谁就是管理员
export async function runSetup(env, body, hashPassword) {
  const domain = String(body.domain || '').trim().toLowerCase().replace(/^@/, '');
  const local = String(body.user || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!DOMAIN_RE.test(domain)) return { error: '域名格式不对，例如 example.com' };
  if (!LOCAL_RE.test(local)) return { error: '用户名只能用小写字母、数字、点、横线、下划线' };
  if (password.length < 10) return { error: '密码至少 10 位' };
  const address = `${local}@${domain}`;
  const secret = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('');
  try {
    // 一个事务：第一条插入 setup_done,已经设置过就会因主键冲突整体失败
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO settings (key, value) VALUES ('setup_done', ?)`).bind(String(Date.now())),
      env.DB.prepare(`INSERT INTO settings (key, value) VALUES ('secret', ?), ('domains', ?), ('catch_all', ?)`).bind(secret, domain, address),
      env.DB.prepare('INSERT INTO users (address, name, pass_hash, is_admin, created_at) VALUES (?, ?, ?, 1, ?)')
        .bind(address, '', await hashPassword(password), Date.now()),
    ]);
  } catch {
    return { error: '已经设置过了，请直接登录', status: 409 };
  }
  cached = null;
  return { ok: true, address };
}
