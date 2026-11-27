// Cloudflare Email Routing「目标地址」:直接转发只能发给这里验证过的邮箱。
// 管理员在「管理中心 → 转发服务」填一次 API Token,之后保存转发地址时自动提交,对方点验证邮件即可。
const BASE = 'https://api.cloudflare.com/client/v4';

async function call(env, token, path, init = {}) {
  const r = await fetch((env.CF_API || BASE) + path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  }).catch(() => null);
  if (!r) throw new Error('无法连接 Cloudflare，请稍后重试');
  const j = await r.json().catch(() => ({}));
  if (!j.success) {
    const e = new Error(j.errors?.[0]?.message || `HTTP ${r.status}`);
    e.code = j.errors?.[0]?.code;
    e.status = r.status;
    throw e;
  }
  return j;
}

// 校验令牌:找到一个能读写目标地址的账户
export async function checkToken(env, token) {
  let accounts;
  try { accounts = (await call(env, token, '/accounts?per_page=50')).result || []; }
  catch (e) { throw new Error(e.status === 401 || e.status === 403 || e.code === 1000 ? 'API Token 无效' : e.message); }
  if (!accounts.length) throw new Error('API Token 缺少「帐户设置：读取」权限，无法识别 Cloudflare 帐户');
  for (const a of accounts) {
    try { await call(env, token, `/accounts/${a.id}/email/routing/addresses?per_page=1`); return { id: a.id, name: a.name }; }
    catch { /* 这个账户没有权限,试下一个 */ }
  }
  throw new Error('API Token 缺少「电子邮件路由地址：编辑」权限');
}

async function listAll(env) {
  const out = [];
  for (let page = 1; page <= 10; page++) {
    const j = await call(env, env.CF_TOKEN, `/accounts/${env.CF_ACCOUNT}/email/routing/addresses?per_page=50&page=${page}`);
    out.push(...(j.result || []));
    if ((j.result || []).length < 50) break;
  }
  return out;
}

// 所有目标地址的验证状态:Map(邮箱 → 'verified' | 'pending')
export async function destStatuses(env) {
  const m = new Map();
  for (const a of await listAll(env)) m.set(String(a.email).toLowerCase(), a.verified ? 'verified' : 'pending');
  return m;
}

export async function destStatus(env, email) {
  return (await destStatuses(env)).get(email) || 'missing';
}

// 提交目标地址;已经存在就直接返回现在的状态。Cloudflare 会给新地址发验证邮件
export async function addDest(env, email) {
  const now = await destStatus(env, email);
  if (now !== 'missing') return now;
  await call(env, env.CF_TOKEN, `/accounts/${env.CF_ACCOUNT}/email/routing/addresses`, { method: 'POST', body: JSON.stringify({ email }) });
  return 'pending';
}

// 重新发送验证邮件:删掉未验证的地址再提交一次
export async function resendDest(env, email) {
  const hit = (await listAll(env)).find((a) => String(a.email).toLowerCase() === email);
  if (hit?.verified) return 'verified';
  if (hit) await call(env, env.CF_TOKEN, `/accounts/${env.CF_ACCOUNT}/email/routing/addresses/${hit.id || hit.tag}`, { method: 'DELETE' });
  await call(env, env.CF_TOKEN, `/accounts/${env.CF_ACCOUNT}/email/routing/addresses`, { method: 'POST', body: JSON.stringify({ email }) });
  return 'pending';
}
