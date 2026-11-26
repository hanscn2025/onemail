// OneMail IMAP 网关：监听 993(TLS)和可选的 143(STARTTLS),把 IMAP 命令翻译成 OneMail 接口调用。
// 不存任何邮件；配置全部来自环境变量，见 README。
import net from 'node:net';
import tls from 'node:tls';
import fs from 'node:fs';
import { OneMail } from './api.js';
import { Session, VERSION } from './session.js';

const env = process.env;
const cfg = {
  url: env.ONEMAIL_URL || '',
  key: env.GATEWAY_KEY || '',
  host: (env.IMAP_HOST || '').trim().toLowerCase().split(':')[0],
  cert: env.TLS_CERT || '',
  keyFile: env.TLS_KEY || '',
  tlsPort: Number(env.IMAPS_PORT ?? 993),
  plainPort: Number(env.IMAP_PORT ?? 143),
  allowPlainLogin: env.ALLOW_PLAIN_LOGIN === '1',
  poll: Number(env.IDLE_POLL_SECONDS || 20),
  maxConn: Number(env.MAX_CONNECTIONS || 200),
};

const log = (level, msg) => console.log(`${new Date().toISOString()} ${level.padEnd(5)} ${msg}`);

if (!cfg.url || !cfg.key) {
  log('error', '缺少 ONEMAIL_URL 或 GATEWAY_KEY,请在 .env 中填写(在 OneMail「管理中心 → IMAP 服务」获取)');
  process.exit(1);
}
// 用 Caddy 自动申请证书时，证书在它的数据目录里(Let's Encrypt 或 ZeroSSL 子目录),按 IMAP_HOST 找
const useCaddy = !cfg.cert && env.CADDY_DATA && cfg.host;
function findCaddyCert() {
  const base = `${env.CADDY_DATA}/caddy/certificates`;
  let issuers = [];
  try { issuers = fs.readdirSync(base); } catch { return; }
  for (const d of issuers) {
    const dir = `${base}/${d}/${cfg.host}`;
    if (fs.existsSync(`${dir}/${cfg.host}.crt`)) { cfg.cert = `${dir}/${cfg.host}.crt`; cfg.keyFile = `${dir}/${cfg.host}.key`; return; }
  }
}

const api = new OneMail(cfg.url, cfg.key);

// ---------- 证书：等它出现(Caddy 首次申请要几十秒),之后每小时检查是否续期 ----------
let ctx = null, certOpts = null, certStamp = '';
function loadCert() {
  if (useCaddy) findCaddyCert();
  if (!cfg.cert || !cfg.keyFile) return false;
  try {
    const stamp = `${fs.statSync(cfg.cert).mtimeMs}|${fs.statSync(cfg.keyFile).mtimeMs}`;
    if (stamp === certStamp) return true;
    const opts = { cert: fs.readFileSync(cfg.cert), key: fs.readFileSync(cfg.keyFile) };
    ctx = tls.createSecureContext(opts);
    certOpts = opts;
    certStamp = stamp;
    if (tlsServer) tlsServer.setSecureContext(opts);
    log('info', `已加载证书 ${cfg.cert}`);
    return true;
  } catch (e) {
    if (e.code !== 'ENOENT') log('error', `证书读取失败：${e.message}`);
    return false;
  }
}

const sessions = new Set();
function accept(socket, secure) {
  if (sessions.size >= cfg.maxConn) { socket.end('* BYE Too many connections\r\n'); return; }
  const s = new Session(socket, { api, secure, secureContext: () => ctx, allowPlainLogin: cfg.allowPlainLogin, pollSeconds: cfg.poll, log });
  sessions.add(s);
  socket.on('close', () => sessions.delete(s));
}

let tlsServer = null;
async function start() {
  // 先向 OneMail 报到，确认地址和密钥正确
  try {
    const r = await api.ping({ version: VERSION, host: cfg.host });
    log('info', `已连接 ${cfg.url}(${r.name})`);
  } catch (e) {
    log('error', `无法连接 OneMail:${e.message}。请检查 ONEMAIL_URL、GATEWAY_KEY,以及后台是否已打开 IMAP 服务`);
  }
  setInterval(() => api.ping({ version: VERSION, host: cfg.host }).catch((e) => log('warn', `报到失败：${e.message}`)), 5 * 60 * 1000);

  if (cfg.tlsPort) {
    let waited = 0;
    while (!loadCert()) {
      if (waited % 60 === 0) log('info', useCaddy ? `等待 Caddy 为 ${cfg.host} 申请证书…(需 DNS 已指向本机、80 端口可从外网访问)` : `等待证书 ${cfg.cert || '(未配置 TLS_CERT / TLS_KEY,也未使用 Caddy)'} …`);
      await new Promise((r) => setTimeout(r, 5000));
      waited += 5;
    }
    tlsServer = tls.createServer({ ...certOpts }, (sock) => accept(sock, true));
    tlsServer.on('tlsClientError', () => {});
    tlsServer.listen(cfg.tlsPort, () => log('info', `IMAPS 监听 ${cfg.tlsPort}`));
    setInterval(loadCert, 60 * 60 * 1000);
    process.on('SIGHUP', loadCert);
  } else loadCert();
  if (cfg.plainPort) {
    net.createServer((sock) => accept(sock, false)).listen(cfg.plainPort, () => log('info', `IMAP(STARTTLS)监听 ${cfg.plainPort}`));
  }
}

for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => {
  for (const s of sessions) { s.send('* BYE Server shutting down'); s.end(); }
  setTimeout(() => process.exit(0), 500);
});

start();
