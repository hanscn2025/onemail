-- 参考用:程序第一次运行时会自动建表和补列,不需要手动执行这个文件

CREATE TABLE IF NOT EXISTS addresses (
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
    created_at INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS autoreply_seen (key TEXT PRIMARY KEY, at INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS login_fail (key TEXT PRIMARY KEY, count INTEGER NOT NULL, until INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at INTEGER NOT NULL,
    kind TEXT NOT NULL,
    actor TEXT NOT NULL DEFAULT '',
    target TEXT NOT NULL DEFAULT '',
    detail TEXT NOT NULL DEFAULT '',
    ip TEXT NOT NULL DEFAULT '');

CREATE TABLE IF NOT EXISTS messages (
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
    moved_at INTEGER);

CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL DEFAULT '',
    pass_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    session_ver INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL, disabled INTEGER NOT NULL DEFAULT 0, quota_mb INTEGER NOT NULL DEFAULT 0, send_limit INTEGER NOT NULL DEFAULT 0, signature TEXT NOT NULL DEFAULT '', fwd_to TEXT NOT NULL DEFAULT '', fwd_keep INTEGER NOT NULL DEFAULT 1, ar_on INTEGER NOT NULL DEFAULT 0, ar_subject TEXT NOT NULL DEFAULT '', ar_body TEXT NOT NULL DEFAULT '', ar_until INTEGER NOT NULL DEFAULT 0, last_login INTEGER NOT NULL DEFAULT 0);

CREATE INDEX IF NOT EXISTS idx_addr_owner ON addresses(owner, kind);

CREATE INDEX IF NOT EXISTS idx_logs_at ON logs(kind, at DESC);

CREATE INDEX IF NOT EXISTS idx_msg_box ON messages(mailbox, folder, date DESC);

CREATE INDEX IF NOT EXISTS idx_msg_trash ON messages(folder, moved_at);
