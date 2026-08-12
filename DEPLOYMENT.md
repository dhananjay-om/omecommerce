# Deployment Guide — Single VPS (Docker Compose + Caddy)

This deploys the full stack to **one server**, matching
`plan/09-deployment-architecture.md`'s "Docker Compose (small clients)"
topology: a single-tenant deployment, all services containerized, one
`docker-compose.prod.yml` on the box.

```
                         Caddy (:80/:443, auto‑TLS)
                          www.yourdomain.com
                         /                  \
                path = /admin*          everything else
                        │                     │
                 admin (Next.js)      storefront (Next.js)
                 basePath: /admin            │
                    └───────────────┬────────┘
                                     │  (internal Docker network only)
                                 api (Express)
                    ┌────────────────┼────────────────┐
                postgres           redis          opensearch  minio
```

**Single domain, path-based split**: the storefront serves the domain root
(`www.yourdomain.com`), the admin app is reverse-proxied at
`www.yourdomain.com/admin` — one DNS record, one TLS cert, no subdomains.
This works because `apps/admin/next.config.ts` sets `basePath: '/admin'`,
which makes Next itself prefix every internal link, redirect, and static
asset URL — so Caddy's `deploy/Caddyfile` just needs to route by path
(`handle /admin*` vs. everything else), not rewrite anything.

Only Caddy publishes ports to the internet. Postgres/Redis/OpenSearch/MinIO/
the API are reachable **only** on the internal Docker network — see
["Why the API isn't public"](#why-the-api-isnt-public) below.

---

## 0. What you need before starting

- A Linux VPS (Ubuntu 22.04/24.04 recommended), reachable over SSH, with at
  least **2 vCPU / 4GB RAM** (OpenSearch alone wants ~1GB; scale up for real
  traffic per plan/09 §2).
- A domain you control, with **one** DNS **A record** already pointed at the
  server's public IP — e.g. `www.yourdomain.com` → server IP. (Admin lives at
  `/admin` on this same domain — no second subdomain needed.)
- Ports **80** and **443** open to the internet (Caddy needs both for the
  Let's Encrypt HTTP-01/TLS-ALPN challenge).

---

## 1. Server prep

SSH into the server, then:

```bash
# Docker Engine + Compose plugin (official convenience script)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker   # or log out/in

# Firewall — only SSH, HTTP, HTTPS
sudo apt-get update && sudo apt-get install -y ufw
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## 2. Get the code onto the server

```bash
sudo mkdir -p /opt/omecommerce && sudo chown $USER:$USER /opt/omecommerce
git clone <your-repo-url> /opt/omecommerce
cd /opt/omecommerce
```

(For later updates you'll just `git pull` here — see [§9](#9-redeploying-updates).)

---

## 3. Configure secrets

```bash
cp .env.production.example .env.production
```

Edit `.env.production` and replace every `CHANGE_ME` with a real random
value — generate each with:

```bash
openssl rand -base64 32
```

`JWT_SECRET` and `GIFT_CARD_HMAC_SECRET` **must be different values** (the
codebase deliberately keeps them separate — see the comment in
`src/config/env.ts`). Also set `DOMAIN` to your real domain (must match the
DNS record from §0) — it's used both by Caddy (TLS cert) and by the
storefront (`SITE_URL`, for `metadataBase`/OpenGraph/sitemap.xml).

`.env.production` is git-ignored — never commit it.

---

## 4. Build and start everything

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

First run takes a few minutes (builds the API image + both Next.js images).
Watch it come up:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api
```

Wait until `api`, `postgres`, `redis`, `opensearch`, and `minio` all show
`healthy`.

---

## 5. Database: migrate + seed

```bash
docker compose -f docker-compose.prod.yml exec api npm run migrate:deploy
docker compose -f docker-compose.prod.yml exec api npm run db:seed
```

- `migrate:deploy` runs every committed Prisma migration (including the raw
  SQL — extensions, `uuidv7()`, triggers, LTREE closure — already folded into
  the migration files, so this one command is sufficient; no separate `psql`
  step, matching what `.github/workflows/ci.yml` does).
- `db:seed` is **idempotent** and creates required reference data (currency,
  the default website/store/store-view, the system attributes every product
  form needs) — you need this even in production. It also creates a **demo**
  "Electronics" attribute set + "Phone A" product and a seeded admin login
  (next step) — delete the demo product from the admin UI once you're live if
  you don't want it.

---

## 6. Object storage: create the media bucket

The app does **not** auto-create its S3 bucket — do it once:

```bash
docker compose -f docker-compose.prod.yml exec minio \
  mc alias set local http://localhost:9000 "$(grep S3_ACCESS_KEY .env.production | cut -d= -f2)" "$(grep S3_SECRET_KEY .env.production | cut -d= -f2)"
docker compose -f docker-compose.prod.yml exec minio mc mb local/ome-media --ignore-existing
```

(Adjust `ome-media` if you changed `S3_BUCKET` in `.env.production`.)

---

## 7. Lock down the seeded admin login — do this immediately

The seed creates a **known dev credential**: `admin@ome.local` /
`dev-only-password-change-me`. Anyone who reads this repo's source knows
that password. Right after seeding:

```bash
docker compose -f docker-compose.prod.yml exec api node -e "
const email = 'admin@ome.local', password = 'dev-only-password-change-me';
fetch('http://localhost:3000/admin/v1/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
}).then(r => r.json()).then(({ data }) =>
  fetch('http://localhost:3000/admin/v1/auth/admin-users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.token },
    body: JSON.stringify({ email: 'you@yourcompany.com', password: '<a-real-strong-password>', roleCodes: ['super-admin'] }),
  })
).then(r => r.json()).then(console.log);
"
```

This runs *inside* the `api` container against its own `localhost:3000` —
`/admin/v1/...` is the **backend's** own route prefix, not something exposed
through either public app, and the API is deliberately not public (see
["Why the API isn't public"](#why-the-api-isnt-public)), so there's no way to
reach it directly from your machine — running it via `docker compose exec`
is the correct way in, not a workaround.

Then log into `https://www.yourdomain.com/admin` with your new account.
There's no "delete admin user" or "change password" UI yet, so the seeded
`admin@ome.local` account still technically exists with its known password —
treat it as a standing risk until that feature is built (worth flagging as
follow-up work), and don't rely on it in the meantime.

---

## 8. Verify it's live

- `https://www.yourdomain.com/admin/login` — log in with your new admin
  account, confirm the dashboard loads.
- `https://www.yourdomain.com` — storefront home page loads with the seeded
  category/product data.
- `docker compose -f docker-compose.prod.yml exec api node -e "fetch('http://localhost:3000/health/ready').then(r=>r.json()).then(console.log)"`
  — should report `database`/`redis` both `ok`.
- Optional: trigger a full search reindex so the storefront's search/PLP has
  data — same `docker compose exec api node -e "..."` pattern as §7, POSTing
  to `http://localhost:3000/admin/v1/search/reindex` with the token from
  logging in, `catalog:manage` permission required.

---

## 9. Redeploying updates

```bash
cd /opt/omecommerce
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
# only if this deploy includes new Prisma migrations:
docker compose -f docker-compose.prod.yml exec api npm run migrate:deploy
```

`docker compose up -d --build` only recreates containers whose image
actually changed, so this is safe to run after every pull. There's brief
downtime per service while it restarts (no rolling-update support in plain
Compose) — acceptable for a single-server deploy; move to the Kubernetes
topology in plan/09 §1–2 if you need zero-downtime rolling deploys later.

---

## 10. Backups

- **Postgres** (the only truly irreplaceable data):
  ```bash
  docker compose -f docker-compose.prod.yml exec -T postgres \
    pg_dump -U ome omecommerce | gzip > backup-$(date +%F).sql.gz
  ```
  Put this on a daily cron job and ship the file off-box (S3, another host,
  etc.) — a backup that lives only on the server it's backing up doesn't
  survive a disk failure.
- **MinIO media**: `docker compose exec minio mc mirror local/ome-media <destination>`,
  or just snapshot the `miniodata` Docker volume.
- **OpenSearch**: don't bother backing it up — it's a derived index,
  fully rebuildable from Postgres via the reindex endpoint in §8.
- **Redis**: cache + BullMQ queue only; acceptable to lose (see plan/09 §6).

---

## 11. Security checklist before real traffic

- [ ] Every value in `.env.production` is a real random secret, not a
      `CHANGE_ME` placeholder.
- [ ] The seeded `admin@ome.local` account has been dealt with (§7).
- [ ] `ufw status` shows only 22/80/443 open.
- [ ] SSH key-based auth only (`PasswordAuthentication no` in
      `/etc/ssh/sshd_config`) if you haven't already hardened this.
- [ ] `.env.production` is not committed and is readable only by your deploy
      user (`chmod 600 .env.production`).
- [ ] You have a working, *tested* restore of the Postgres backup from §10 —
      an untested backup is not a backup.

---

## Why the API isn't public

Both Next.js apps call the backend **server-side** (Server Components /
Server Actions / the storefront's own Route Handlers proxy) — the browser
never talks to `api` directly, and neither app's client-side code holds a raw
JWT. So the API only needs to be reachable on the internal Docker network,
which is both simpler and reduces attack surface. If you later need direct
external API access (a mobile app, inbound payment-gateway webhooks), uncomment
the `api_domain` block in `deploy/Caddyfile` and add an `API_DOMAIN` entry to
`.env.production`.

---

## Known gaps — not production-ready yet, by design

These are real, intentional scope cuts already documented elsewhere in this
repo (not deployment bugs) — don't be surprised by them in production:

- **Payments**: the only gateway wired up is `TestPaymentGateway`, which
  always succeeds (or fails on request) — there is no real payment processor
  integration. Checkout will "work" but isn't charging real cards. Adding a
  real PSP is separate backend work behind the existing `PaymentGateway` port.
- **Order emails**: `simulated-email-sender.ts` logs emails instead of
  sending them — no SMTP/transactional-email provider is wired up yet.
  Customers will not actually receive order confirmation/shipping emails
  until a real sender is plugged in.
- **Admin password reset / user deletion**: doesn't exist yet (see §7).

None of these block deploying and using the admin/catalog/inventory/order
management features — they specifically affect real money movement and
customer email, so treat "go-live for real transactions" as gated on closing
these, not on this deployment guide.
