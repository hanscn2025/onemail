# OneMail: one domain, unlimited mailboxes

[中文](README.md) | English

A webmail that runs entirely on Cloudflare. Mail sent to `anything@your-domain` lands in your web inbox. No server needed, and personal use fits within Cloudflare's free tier.

- **Receive at any address**: any prefix `@your-domain` works. Each message shows which address it was sent to, and you can filter by address
- **Temporary addresses**: write any prefix when signing up and it receives mail; after its first message it appears in the temporary address list, where you can add a note, set an expiry or disable it (later mail bounces). Where this mail goes is one global setting: the admin mailbox by default, or a custom mailbox such as Gmail
- **Business-style accounts**: separate accounts for family or teammates; each person signs in, sends and receives, and sees only their own mail. Bulk creation is supported
- **Aliases and groups**: `sales@` lands in alice's inbox and she can send as it; `team@` delivers one message to several members (external addresses allowed)
- **Full mail features**: compose, reply, forward, drafts, signature, auto-reply, forwarding to an external mailbox; replies default to the address the mail was sent to
- **Admin console**: overview stats, accounts (disable, storage quota, daily send limit, password reset, sign out everywhere), aliases and groups, all temporary addresses, sending setup, and login / delivery / sending logs
- Remote images are blocked by default (anti-tracking), HTML mail is rendered in a sandbox, and trash is emptied after 30 days
- `name+anything@domain` goes to the same mailbox

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
4. Check Admin console → Logs → Receiving to see whether the message was bounced (address disabled or expired, mailbox full)

## How a message is delivered

1. To an **account address**: into that account's inbox, and also forwarded if the account has forwarding set
2. To an **alias, group or temporary address**: according to its own settings; disabled or expired addresses bounce
3. To **any other address** (temporary addresses): handled by Settings → Temporary mail destination, which stores it in the admin mailbox by default or forwards it to a custom mailbox

## Forwarding to external mailboxes

The temporary mail destination (global), account forwarding (when creating an account or in personal settings) and group members can all be external mailboxes such as Gmail or Outlook. Forwarding uses Cloudflare's built-in forwarding: free and outside the sending quota, but **each external mailbox must be verified once**:

Cloudflare dashboard → your domain → Email → Email Routing → Destination addresses → Add, then click the verification link sent to that mailbox.

Forwarding to an unverified address fails; you will see it in the admin overview and logs.

To skip verification, set the forwarding method of the temporary mail destination or an account to **通过发信服务转发 (via sending service)**. This needs Resend sending (below): the message is re-sent through Resend, so any mailbox works without verification. The trade-offs: the recipient sees your receiving address as the sender (replies still go to the original sender), and every forwarded message counts toward your sending quota. External group members always use direct forwarding.

## How it works

- **Receiving**: Email Routing hands every message for the domain to the Worker's `email()` handler. After parsing with postal-mime, message metadata is stored in D1; bodies, attachments and the original .eml go to R2.
  If the address has an account, the message goes there; otherwise it goes to the admin mailbox (the admin address from first-run setup).
- **Web app**: a single-page app in `public/`. Sessions use an HttpOnly cookie; every state-changing request must carry the `X-Mail: 1` header (CSRF protection); 5 wrong passwords in a row from the same IP or for the same account lock it for 15 minutes.
- **Addresses**: the `addresses` table holds temporary addresses, aliases and groups; the `logs` table holds login, delivery, forwarding and sending records (kept 90 days). Tables and new columns are created on first run, and older databases are upgraded automatically.
- **Config**: first-run setup writes the domain, catch-all mailbox, catch-all forward, session secret and Resend key to the D1 `settings` table. They can be overridden with vars / secrets: `DOMAINS` (comma-separated), `CATCH_ALL`, `SESSION_SECRET`, `RESEND_API_KEY`.
- **Cron**: every day at 03:17 UTC, messages that have been in the trash longer than `TRASH_DAYS` days and expired logs are deleted.

## Enable sending

Receiving works without this. To send mail, use Resend's free tier (100 emails/day, 3,000/month):

1. Sign up for free at [resend.com](https://resend.com) and add your domain under **Domains**. Choose the automatic Cloudflare setup to have the DNS records added for you, then wait until the status is **Verified**.
2. Under **API Keys**, create a key (**Sending access** is enough) and copy it.
3. Sign in as admin → 管理中心 (Admin center) → 发信 (Sending), paste the key and save. The page tells you whether your domain has been verified.

The free quota is shared by all accounts; you can set a per-account daily send limit under Admin console → Accounts.

Compose, reply and forward then work. Instead of the web page, you can also add a `RESEND_API_KEY` secret under the Worker's **Settings → Variables and Secrets**; it takes priority over the key entered on the page.

Alternatively, use Cloudflare's own Email Sending, which requires the Workers Paid plan: add `[[send_email]]` (`name = "EMAIL"`) to `wrangler.toml`, redeploy, then enable Email Sending for the domain in the dashboard.

## Using Foxmail / Outlook

Cloudflare Workers can't serve IMAP/POP3, so desktop clients can't log in directly. Instead:

- **Receive**: set *Settings → Forward to external mailbox* to Gmail/QQ and add that account to your client.
- **Send**: add an SMTP server in your client and send as `you@your-domain`:

| Field | Value |
|---|---|
| Server | `smtp.resend.com` |
| Port | `465` (SSL/TLS), or `587` (STARTTLS) |
| Username | `resend` |
| Password | a Resend API key — create one per person with *Sending access* |

Mail sent from a client won't show up in the web app's *Sent* folder. Full steps are at the bottom of the Settings page.

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
