# OneMail:一个域名,无数个邮箱

部署在 Cloudflare 上的网页邮箱。发给 `任意名字@你的域名` 的信都会进你的网页邮箱,不用服务器,个人使用在 Cloudflare 免费额度内。

- 任意地址收信:没建过的地址也能收,列表里标出每封信是发给哪个地址的,可以按地址筛选
- 多个独立邮箱:给家人、同事建账号,各自登录,只看得到自己的信;支持批量创建
- `名字+任意内容@域名` 进同一个邮箱
- 外部图片默认不加载(防追踪),信件 HTML 在沙盒里显示
- 垃圾箱 30 天自动清空
- 发信:接上免费的 Resend(每天 100 封)就能写信、回复、转发,还能用收信的那个地址回信

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

## 结构

- **收信**:Email Routing 把整个域名的信交给 Worker 的 `email()`。用 postal-mime 解析后,信件信息存在 D1,正文、附件和原始 .eml 存在 R2。
  地址有对应账号就进那个账号;没有就进管理员邮箱(首次设置时的管理员地址)。
- **网页**:`public/` 下的单页应用。登录用 HttpOnly cookie;所有修改类请求必须带 `X-Mail: 1` 头(防 CSRF);同一 IP 或账号连续输错 5 次密码锁 15 分钟。
- **配置**:首次设置时写进 D1 的 `settings` 表(域名、接收未知地址的邮箱、会话密钥)。也可以用 vars / secret 覆盖:`DOMAINS`(逗号分隔)、`CATCH_ALL`、`SESSION_SECRET`。
- **定时任务**:每天 03:17 UTC 清掉在垃圾箱里放了超过 `TRASH_DAYS` 天的信。

## 开启发信

不开通也能正常收信。想发信,用 Resend 的免费额度(每天 100 封、每月 3000 封):

1. 到 [resend.com](https://resend.com) 免费注册,在 Domains 里添加你的域名。选自动配置 Cloudflare,它会帮你加好 DNS 记录;等状态变成 Verified。
2. 在 API Keys 里创建一个 Key(Sending access 就够),复制下来。
3. 用管理员登录邮箱 → 邮箱账号管理 → 发信(Resend),粘贴 Key 保存。页面会告诉你域名有没有验证通过。

之后「写信」「回复」「转发」就能用了。也可以不在网页里填,改在 Worker 的「设置 → 变量和机密」里加机密 `RESEND_API_KEY`,它优先于网页里填的。

另一种方式是 Cloudflare 自己的 Email Sending,需要 Workers 付费版:在 `wrangler.toml` 里加 `[[send_email]]`(`name = "EMAIL"`),重新部署后在后台给域名开启 Email Sending。

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
