# OneMail: one domain, unlimited mailboxes

[中文](README.md) | English

A webmail that runs entirely on Cloudflare. Mail sent to `anything@your-domain` lands in your web inbox. No server needed, and personal use fits within Cloudflare's free tier.

- Receive at any address: addresses you never created still work. Each message shows which address it was sent to, and you can filter by address
- Separate mailboxes: create accounts for family or teammates; each person signs in and sees only their own mail. Bulk creation is supported
- `name+anything@domain` goes to the same mailbox
- Remote images are blocked by default (anti-tracking), and HTML mail is rendered in a sandbox
- Trash is emptied automatically after 30 days
- Sending: connect the free Resend plan (100 emails/day) to compose, reply and forward, including replying from the address the mail was sent to

> The web interface is currently in Chinese only.

## One-click deploy (no command line)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/hanscn2025/onemail)

Prerequisite: your domain is already on Cloudflare.

1. Click the button above, sign in to Cloudflare and connect GitHub. Keep the defaults and click **Create and deploy**. The database (D1) and storage bucket (R2) are created for you.
2. When it finishes, open the `xxx.workers.dev` URL. On the first-run setup page (首次设置), enter your domain, an admin username and a password.
   **Do this right after deploying**: the setup page works only once, and whoever completes it first becomes the admin.
3. In the Cloudflare dashboard → your domain → **Email** → **Email Routing**: enable it, then set the **Catch-all** action to **Send to a Worker**, choose `onemail` as the destination, and make sure the rule is enabled.
4. (Optional) In the Worker's **Settings → Domains & Routes**, add a custom domain such as `mail.your-domain`.
5. (Optional) Turn on sending, see [Enable sending](#enable-sending) below.

Note: if this domain already uses another mail service (Google Workspace, Microsoft 365, etc.), that service will stop receiving mail once Email Routing is enabled.

### Not receiving mail?

1. Is Email Routing enabled?
2. Does the Catch-all rule point to your Worker, and is it enabled?
3. Is the domain you entered during first-run setup correct?

## How it works

- **Receiving**: Email Routing hands every message for the domain to the Worker's `email()` handler. After parsing with postal-mime, message metadata is stored in D1; bodies, attachments and the original .eml go to R2.
  If the address has an account, the message goes there; otherwise it goes to the admin mailbox (the admin address from first-run setup).
- **Web app**: a single-page app in `public/`. Sessions use an HttpOnly cookie; every state-changing request must carry the `X-Mail: 1` header (CSRF protection); 5 wrong passwords in a row from the same IP or for the same account lock it for 15 minutes.
- **Config**: first-run setup writes the domain, catch-all mailbox and session secret to the D1 `settings` table. They can be overridden with vars / secrets: `DOMAINS` (comma-separated), `CATCH_ALL`, `SESSION_SECRET`.
- **Cron**: every day at 03:17 UTC, messages that have been in the trash longer than `TRASH_DAYS` days are deleted.

## Enable sending

Receiving works without this. To send mail, use Resend's free tier (100 emails/day, 3,000/month):

1. Sign up for free at [resend.com](https://resend.com) and add your domain under **Domains**. Choose the automatic Cloudflare setup to have the DNS records added for you, then wait until the status is **Verified**.
2. Under **API Keys**, create a key (**Sending access** is enough) and copy it.
3. Sign in as admin → 邮箱账号管理 (account management) → 发信(Resend) (sending), paste the key and save. The page tells you whether your domain has been verified.

Compose, reply and forward then work. Instead of the web page, you can also add a `RESEND_API_KEY` secret under the Worker's **Settings → Variables and Secrets**; it takes priority over the key entered on the page.

Alternatively, use Cloudflare's own Email Sending, which requires the Workers Paid plan: add `[[send_email]]` (`name = "EMAIL"`) to `wrangler.toml`, redeploy, then enable Email Sending for the domain in the dashboard.

## CLI deploy and local development

```bash
npm install
npx wrangler login
npx wrangler deploy          # creates D1 and R2 automatically; then open the URL for first-run setup
```

Local development:
```bash
npx wrangler dev --port 8788
# Simulate an incoming message (a Message-ID header is required; write + as %2B)
curl -X POST 'http://127.0.0.1:8788/cdn-cgi/handler/email?from=a@x.com&to=bob@example.com' --data-binary @mail.eml
```

Create an account or reset a password from the command line:
```bash
ONEMAIL_PASSWORD='new-password' node scripts/create-user.mjs someone@example.com [--admin] > u.sql
npx wrangler d1 execute DB --remote --file u.sql -y && rm u.sql
```

## License

MIT, see [LICENSE](LICENSE).
