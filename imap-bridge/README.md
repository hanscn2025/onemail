# OneMail IMAP 网关(可选，预览版)

> **预览版**:接口和后台开关已就绪，网关尚未正式发布，部署方式后续可能调整。

让 Foxmail、Outlook、Thunderbird、iPhone 邮件等客户端**直接收 OneMail 的信**。

OneMail 本身跑在 Cloudflare Workers 上，Workers 不能开 IMAP 端口，所以 IMAP 需要一个单独常驻的小服务——就是这个网关。它是**可选的升级**:

- **不部署**:OneMail 一切照旧。客户端收信继续用「设置 → 转发设置」转到 Gmail / QQ 邮箱;发信用 Resend SMTP。
- **部署后**:客户端用 OneMail 的邮箱地址和登录密码直接收信，已读、星标、删除、移动都会同步回网页版。

网关**不存任何邮件**,每个 IMAP 命令都实时读写 OneMail;重启、换机器不会丢信。

## 需要什么

一台**能跑 Docker、能开放端口**的机器,任选其一:

- 云服务器 / VPS(最省心,有公网 IP)
- 家里的 NAS、软路由、常开的电脑(需要公网 IP 或端口映射；运营商封了 80 端口时用「自有证书」方式)

要能从外网访问的端口:

| 端口 | 用途 |
|---|---|
| 993 | IMAP over SSL/TLS(客户端主要用这个) |
| 143 | IMAP + STARTTLS(可选,`IMAP_PORT=0` 关闭) |
| 80、443 | 仅 Caddy 自动申请证书时需要 |

内存占用约 50 MB,一核小机器足够。

## 部署(约 5 分钟)

### 1. 在 OneMail 后台打开 IMAP 服务

管理员登录 OneMail → **管理中心 → IMAP 服务** → 打开开关，网关地址填 `imap.你的域名`,保存。页面上会出现三行**网关配置**,复制下来。

### 2. 添加 DNS 记录

在你的域名 DNS(比如 Cloudflare)里加一条:

| 类型 | 名称 | 内容 | 代理 |
|---|---|---|---|
| A | `imap` | 服务器公网 IP | **关闭**(灰色云朵) |

> Cloudflare 的橙色云朵只代理网页流量，不转发 IMAP,一定要关掉。

### 3. 启动网关

```bash
git clone https://github.com/hanscn2025/onemail.git
cd onemail/imap-bridge
cp .env.example .env
nano .env        # 粘贴第 1 步复制的三行
docker compose up -d
```

第一次启动时 Caddy 会自动为 `imap.你的域名` 申请免费证书(几十秒),之后自动续期。查看日志:

```bash
docker compose logs -f imap-bridge
```

看到 `IMAPS 监听 993` 就好了。

### 4. 测试

回到 **管理中心 → IMAP 服务**,点「测试连接」。显示「连接成功」后，所有账号在 **设置 → 客户端** 里就能看到 IMAP 服务器设置。

## 已经有证书 / 80 端口被占用

服务器上已经有 nginx、宝塔等占着 80/443,或者你用 acme.sh 自己签证书时，不用 Caddy:

1. 把证书放到 `imap-bridge/certs/` 下(或者软链接过来),例如 `fullchain.pem`、`privkey.pem`。证书要包含 `imap.你的域名`(通配证书也行)。
2. `.env` 里删掉 `COMPOSE_PROFILES=caddy`,填上:
   ```
   TLS_CERT=/certs/fullchain.pem
   TLS_KEY=/certs/privkey.pem
   ```
3. `docker compose up -d`

证书续期后网关一小时内会自动换上新证书，也可以 `docker compose kill -s HUP imap-bridge` 立即生效。

## 在客户端里添加

| 项目 | 填写 |
|---|---|
| 收件服务器(IMAP) | `imap.你的域名` |
| 端口 | `993`,加密 SSL/TLS(或 `143` + STARTTLS) |
| 用户名 | 完整邮箱地址，如 `you@你的域名` |
| 密码 | OneMail 的登录密码 |
| 发件服务器(SMTP) | 见 OneMail「设置 → 客户端」(Resend) |

客户端里会看到这些文件夹:

| 客户端里 | OneMail | 说明 |
|---|---|---|
| INBOX | 收件箱 | |
| Sent | 已发送 | 客户端发信后保存的副本也会存进来 |
| Drafts | 草稿 | |
| Trash | 垃圾箱 | 在这里删除 = 彻底删除 |
| Starred | 星标 | 虚拟文件夹，取消星标就会从这里消失 |

- 在其他文件夹里删除的信会**移到垃圾箱**,和网页版一致。
- 不支持新建、重命名文件夹。
- 新邮件推送用 IDLE 实现，默认每 20 秒检查一次(`IDLE_POLL_SECONDS`)。

## 安全

- 网关和 OneMail 之间用**网关密钥**认证；密钥只在 OneMail 后台显示。泄露时在后台点「重新生成密钥」,旧密钥立即失效。
- 在后台**关闭 IMAP 服务**后，网关立即无法访问 OneMail,已登录的客户端会被断开。
- 客户端登录走 OneMail 的密码校验和失败锁定(同一 IP 或账号连续失败 5 次锁 15 分钟);登录记录在「管理中心 → 记录 → 登录」里，详情标注「IMAP 客户端」。
- 改密码、停用账号后，已登录的客户端会被要求重新登录。
- 993 端口只接受 TLS;143 端口必须先 STARTTLS 才能登录。

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `ONEMAIL_URL` | — | OneMail 网页地址，如 `https://mail.example.com` |
| `GATEWAY_KEY` | — | 网关密钥(后台复制) |
| `IMAP_HOST` | — | 网关域名，Caddy 用它申请证书 |
| `TLS_CERT` / `TLS_KEY` | — | 自有证书路径；不填则用 Caddy 的证书 |
| `IMAPS_PORT` | `993` | `0` 关闭 |
| `IMAP_PORT` | `143` | STARTTLS 端口,`0` 关闭 |
| `IDLE_POLL_SECONDS` | `20` | IDLE 时检查新信的间隔 |
| `MAX_CONNECTIONS` | `200` | 最大同时连接数 |

## 不用 Docker

需要 Node.js 20 以上，没有第三方依赖:

```bash
cd imap-bridge
ONEMAIL_URL=https://mail.example.com GATEWAY_KEY=... IMAP_HOST=imap.example.com \
TLS_CERT=/path/fullchain.pem TLS_KEY=/path/privkey.pem node src/server.js
```

## 常见问题

- **测试连接提示「无法连接」**:检查 DNS 是否指向服务器且关闭了代理、防火墙/安全组是否放行 993、`docker compose ps` 是否在运行、证书是否申请成功(看日志)。
- **日志一直「等待 Caddy 申请证书」**:80 端口要能从外网访问，且 DNS 已生效。运营商封了 80 端口时改用「自有证书」(acme.sh DNS 验证)。
- **日志提示「无法连接 OneMail」**:检查 `ONEMAIL_URL`、`GATEWAY_KEY`,以及后台的 IMAP 服务开关是否打开。
- **客户端提示登录失败**:用户名要写完整邮箱地址，密码是 OneMail 网页登录密码；连续失败 5 次会锁 15 分钟。
