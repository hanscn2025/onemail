// 生成建邮箱账号的 SQL。用法:
//   node scripts/create-user.mjs <地址> [--admin] > /tmp/x.sql
// 密码从环境变量 ONEMAIL_PASSWORD 读,不走命令行参数,避免留在 shell 历史里
import { hashPassword } from '../src/auth.js';
const [address, flag] = process.argv.slice(2);
const pw = process.env.ONEMAIL_PASSWORD;
if (!address || !pw) { console.error('需要地址参数和 ONEMAIL_PASSWORD 环境变量'); process.exit(1); }
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const hash = await hashPassword(pw);
console.log(`INSERT INTO users (address, name, pass_hash, is_admin, created_at) VALUES (${q(address.toLowerCase())}, '', ${q(hash)}, ${flag === '--admin' ? 1 : 0}, ${Date.now()})
ON CONFLICT(address) DO UPDATE SET pass_hash = excluded.pass_hash, is_admin = excluded.is_admin, session_ver = session_ver + 1;`);
