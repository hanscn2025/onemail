# OneMail:一个域名,无数个邮箱

中文 | [English](README.en.md)

部署在 Cloudflare 上的网页邮箱。发给 `任意名字@你的域名` 的信都会进你的网页邮箱,不用服务器,个人使用在 Cloudflare 免费额度内。

- **任意地址收信**:随便写一个前缀 `@你的域名` 都能收到,列表里标出每封信是发给哪个地址的,可以按地址筛选
- **临时邮箱**:注册网站时随便写一个前缀就能收信,收到第一封后自动出现在临时邮箱列表,可以写备注、设有效期,不想要了一键停用(之后的信直接退回)。收到的信去哪是一个全局设置:默认管理员邮箱,也可以改成 Gmail、QQ 邮箱等自定义邮箱
- **企业邮箱式的子账号**:给家人、同事建独立账号,各自登录、收发信,只看得到自己的信;支持批量创建
- **别名和群组**:`sales@` 进 alice 的邮箱、alice 也能用它发信;`team@` 一封信送给多个成员(可以含外部邮箱)
- **收发功能**:写信、回复、转发、草稿、签名、自动回复、转发到外部邮箱;回复时默认用收信的那个地址
- **管理**:概览统计;「账号和地址」里管理账号(停用、存储上限、每天发信上限、重设密码、强制下线)、别名和群组、所有临时地址、发信设置、登录/收信/发信记录
- **Telegram 通知**:新邮件推送到 Telegram,带「打开邮件」按钮
- 外部图片默认不加载(防追踪),信件 HTML 在沙盒里显示;垃圾箱 30 天自动清空
- `名字+任意内容@域名` 进同一个邮箱

## 网页一键部署(不用命令行)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/hanscn2025/onemail)

前提:你的域名已经接入 Cloudflare。

1. 点上面的按钮,登录 Cloudflare、连接 GitHub,部署页面用默认值,点创建并部署。数据库(D1)和存储桶(R2)会自动建好。
2. 部署完成后打开 `xxx.workers.dev` 网址,在「首次设置」页面填你的域名、管理员用户名和密码。
   **部署完马上做这一步**:设置页面只能用一次,谁先填谁就是管理员。
3. Cloudflare 后台 → 你的域名 → 电子邮件 → 电子邮件路由:启用,然后把 Catch-all 的操作设成「发送到 Worker」,目标选 `onemail`,确认是启用状态。
4. (可选)在 Worker 的「设置 → 域和路由」里加自定义域,比如 `mail.你的域名`。
5. (可选)开通发信,见下文「开启发信」。

注意:这个域名原来如果配过别的邮箱服务(企业邮箱等),开启电子邮件路由后原邮箱就收不到信了。

### 收不到信时检查

1. 电子邮件路由是否已启用
2. Catch-all 是否指向你部署的 Worker,并且已启用
3. 首次设置里填的域名是否正确
4. 账号和地址 → 记录 → 收信,看信是不是被退回了(地址停用、过期、邮箱满了)

## 一封信怎么送

1. 发给**账号地址**:进那个账号的邮箱;账号设置了转发就同时转发
2. 发给**别名、群组、临时地址**:按它们各自的设置送;停用或过期的直接退回
3. 发给**其他任何地址**(临时邮箱):按「账号和地址 → 临时邮箱」里的收件地址处理,默认存进管理员邮箱,也可以改成转发到自定义邮箱

## 转发到外部邮箱

临时邮箱收件地址(全局)、账号转发(新建账号时或个人设置里)、群组成员都可以是 Gmail、QQ 邮箱等外部地址。转发用的是 Cloudflare 自带的转发,免费、不占发信额度,但**每个外部邮箱要先验证一次**:

Cloudflare 后台 → 你的域名 → 电子邮件 → 电子邮件路由 → 目标地址 → 添加地址,然后去那个邮箱点验证链接。

没验证的地址转发会失败,概览和记录里能看到。

不想验证的话,临时邮箱收件地址和账号转发都可以把「转发方式」改成**通过发信服务转发**(需要先开通下面的 Resend 发信):信会用 Resend 重新发出去,任何邮箱都能收,不用验证。区别是对方看到的发件人是收信地址(回复仍会回到原发件人),而且每封都占发信额度。群组里的外部成员仍走直接转发。

## 结构

- **收信**:Email Routing 把整个域名的信交给 Worker 的 `email()`。用 postal-mime 解析后,信件信息存在 D1,正文、附件和原始 .eml 存在 R2。
  地址有对应账号就进那个账号;没有就进管理员邮箱(首次设置时的管理员地址)。
- **网页**:`public/` 下的单页应用。登录用 HttpOnly cookie;所有修改类请求必须带 `X-Mail: 1` 头(防 CSRF);同一 IP 或账号连续输错 5 次密码锁 15 分钟。
- **地址**:`addresses` 表存临时地址、别名、群组;`logs` 表存登录、投递、转发、发信记录(保留 90 天)。表和新增的列在程序第一次运行时自动建好,老数据库会自动升级。
- **配置**:首次设置时写进 D1 的 `settings` 表(域名、兜底邮箱、兜底转发、会话密钥、Resend Key)。也可以用 vars / secret 覆盖:`DOMAINS`(逗号分隔)、`CATCH_ALL`、`SESSION_SECRET`、`RESEND_API_KEY`。
- **定时任务**:每天 03:17 UTC 清掉在垃圾箱里放了超过 `TRASH_DAYS` 天的信,以及过期的记录。

## 开启发信

不开通也能正常收信。想发信,用 Resend 的免费额度(每天 100 封、每月 3000 封):

1. 到 [resend.com](https://resend.com) 免费注册,在 Domains 里添加你的域名。选自动配置 Cloudflare,它会帮你加好 DNS 记录;等状态变成 Verified。
2. 在 API Keys 里创建一个 Key(Sending access 就够),复制下来。
3. 用管理员登录邮箱 → 账号和地址 → 发信,粘贴 Key 保存。页面会告诉你域名有没有验证通过。

免费额度所有账号共用,可以在「账号和地址 → 账号」里给每个人设每天发信上限。

之后「写信」「回复」「转发」就能用了。也可以不在网页里填,改在 Worker 的「设置 → 变量和机密」里加机密 `RESEND_API_KEY`,它优先于网页里填的。

另一种方式是 Cloudflare 自己的 Email Sending,需要 Workers 付费版:在 `wrangler.toml` 里加 `[[send_email]]`(`name = "EMAIL"`),重新部署后在后台给域名开启 Email Sending。

## Telegram 通知

新邮件可以推送到 Telegram,不经过邮件路由,不用在 Cloudflare 验证地址,也不占发信额度。

1. 在 Telegram 找 [@BotFather](https://t.me/BotFather),发送 `/newbot` 建一个机器人,复制它给的 Token。
2. 管理员登录 → 设置 → 通知,在「Telegram 机器人」里粘贴 Token 保存(要在线上 https 地址操作,Telegram 才能回调)。
3. 每个人在 设置 → 通知 点「绑定 Telegram」,跳到机器人后点「开始」就绑好了。

可以选是否带正文摘要、是否推送群发/订阅类邮件。在机器人里发 `/stop` 可以解除绑定。注意:选了带正文摘要,摘要会经过 Telegram 的服务器。

## 在 Foxmail / Outlook 里使用

Cloudflare Workers 不能提供 IMAP/POP3 服务,所以客户端不能直接登录这个邮箱。可以这样用:

- **收信**:在「设置 → 转发到外部邮箱」填 QQ 邮箱或 Gmail,在客户端里添加那个邮箱。
- **发信**:在客户端里加一个 SMTP 发件服务器,用 `你@你的域名` 的身份发信:

| 项目 | 填写 |
|---|---|
| 服务器 | `smtp.resend.com` |
| 端口 | `465`(SSL/TLS),连不上时用 `587`(STARTTLS) |
| 用户名 | `resend` |
| 密码 | Resend API Key,建议每人单独建一个 Sending access 的 Key |

从客户端发出的信不会出现在网页版的「已发送」里。登录后在「设置」页底部有完整步骤。

## 命令行部署和本机开发

```bash
npm install
npx wrangler login
npx wrangler deploy          # 自动创建 D1 和 R2,然后打开网址做首次设置
```

本机开发:
```bash
npx wrangler dev --port 8788
# 模拟收一封信(Message-ID 头必须有;+ 号要写成 %2B)
curl -X POST 'http://127.0.0.1:8788/cdn-cgi/handler/email?from=a@x.com&to=bob@example.com' --data-binary @mail.eml
```

命令行建账号或重设密码:
```bash
ONEMAIL_PASSWORD='新密码' node scripts/create-user.mjs someone@example.com [--admin] > u.sql
npx wrangler d1 execute DB --remote --file u.sql -y && rm u.sql
```

## 许可证

MIT,见 [LICENSE](LICENSE)。
