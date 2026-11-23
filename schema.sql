CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  pass_hash TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  session_ver INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  mailbox TEXT NOT NULL,
  folder TEXT NOT NULL,            -- inbox | sent | trash
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
  moved_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_msg_box ON messages(mailbox, folder, date DESC);
CREATE INDEX IF NOT EXISTS idx_msg_trash ON messages(folder, moved_at);

CREATE TABLE IF NOT EXISTS login_fail (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  until INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
