# Deployment Guide — Single VPS (Docker Compose + nginx)

This deploys the full stack to **one server**, matching
`plan/09-deployment-architecture.md`'s "Docker Compose (small clients)"
topology: a single-tenant deployment, all services containerized, one
`docker-compose.prod.yml` on the box.

```
                          nginx (:80/:443, TLS via certbot)
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
asset URL — so `deploy/nginx.conf` just needs to route by path (`location
/admin` vs. everything else), not rewrite anything.

Unlike Caddy, nginx has no built-in ACME client, so a separate `certbot`
container handles TLS: a one-time bootstrap script
(`deploy/init-certbot.sh`) gets the first certificate, and the `certbot`
service then renews it automatically forever after — see
[§4](#4-build-and-start-everything).

Only nginx publishes ports to the internet. Postgres/Redis/OpenSearch/MinIO/
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
- Ports **80** and **443** open to the internet (80 for the Let's Encrypt
  HTTP-01 challenge and the HTTP→HTTPS redirect, 443 for the site itself).

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
`src/config/env.ts`). Also set `DOMAIN` (must match the DNS record from §0)
and `LETSENCRYPT_EMAIL` — `DOMAIN` feeds the storefront's `SITE_URL` (for
`metadataBase`/OpenGraph/sitemap.xml) and `deploy/init-certbot.sh`'s
certificate request.

Also edit **`deploy/nginx.conf`** and replace every `YOUR_DOMAIN_HERE` with
that same domain — nginx, unlike Caddy, has no env-var substitution, so this
one has to be a real text edit, not just a `.env` value.

`.env.production` is git-ignored — never commit it.

---

## 4. Build and start everything

Every `docker compose` command from here on needs **both** `-f
docker-compose.prod.yml` and `--env-file .env.production` — set up a shell
alias once so you don't have to retype (or forget) it:

```bash
alias dc='docker compose -f docker-compose.prod.yml --env-file .env.production'
```

> **If you skip `--env-file`:** `docker compose exec` will still work against
> an *already-running* container (its real env vars were fixed when it was
> started, not when you `exec` into it) — but you'll get a wall of `WARN...
> variable is not set. Defaulting to a blank string.` noise, and any command
> that needs to *create* something new (`up`, `run`) will get real blank
> values, not just warnings. Always pass it.

Start everything **except nginx** first — nginx's config points at a TLS
certificate that doesn't exist yet, so starting it now would just crash-loop:

```bash
dc up -d --build postgres redis opensearch minio api admin storefront certbot
```

First run takes a few minutes (builds the API image + both Next.js images).
Watch it come up:

```bash
dc ps
dc logs -f api
```

Wait until `api`, `postgres`, `redis`, `opensearch`, and `minio` all show
`healthy`.

Then get your first TLS certificate — a one-time bootstrap (see
`deploy/init-certbot.sh`'s header comment for exactly why this needs a
script rather than "just start nginx"):

```bash
./deploy/init-certbot.sh
```

This starts `nginx` itself as one of its steps — you won't need to start it
separately. From here on, the `certbot` service you already started keeps
the certificate renewed automatically; you never run this script again on
this server (only if you tear down the `certbot_certs` volume and start
over).

---

## 5. Database: migrate + seed

```bash
dc exec api npm run migrate:deploy
dc exec api npm run db:seed
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
dc exec minio \
  mc alias set local http://localhost:9000 "$(grep S3_ACCESS_KEY .env.production | cut -d= -f2)" "$(grep S3_SECRET_KEY .env.production | cut -d= -f2)"
dc exec minio mc mb local/ome-media --ignore-existing
```

(Adjust `ome-media` if you changed `S3_BUCKET` in `.env.production`.)

---

## 7. Lock down the seeded admin login — do this immediately

The seed creates a **known dev credential**: `admin@ome.local` /
`dev-only-password-change-me`. Anyone who reads this repo's source knows
that password. Right after seeding:

```bash
dc exec api node -e "
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
- `dc exec api node -e "fetch('http://localhost:3000/health/ready').then(r=>r.json()).then(console.log)"`
  — should report `database`/`redis` both `ok`.
- **Not actually optional in practice** — trigger a full search reindex, or
  every storefront page that queries search (home, PLP/category, best-
  selling) will 500 with `index_not_found_exception`: the OpenSearch index
  is created lazily on first write, so until something indexes into it, it
  simply doesn't exist yet. Run `./deploy/reindex-search.sh`, or by hand:
  same `dc exec api node -e "..."` pattern as §7, POSTing to
  `http://localhost:3000/admin/v1/search/reindex` with the token from
  logging in — needs `admin:manage` permission, not `catalog:manage`.

---

## 9. Redeploying updates

```bash
cd /opt/omecommerce
git pull
dc up -d --build
# only if this deploy includes new Prisma migrations:
dc exec api npm run migrate:deploy
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
  dc exec -T postgres pg_dump -U ome omecommerce | gzip > backup-$(date +%F).sql.gz
  ```
  Put this on a daily cron job and ship the file off-box (S3, another host,
  etc.) — a backup that lives only on the server it's backing up doesn't
  survive a disk failure. `dc` is the alias from §4 — if this runs from
  cron (not an interactive shell), define the same alias as a variable in
  the cron script instead, since cron doesn't load your shell's aliases.
- **MinIO media**: `dc exec minio mc mirror local/ome-media <destination>`,
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

## Alternative: fronting with an existing host nginx

Everything above assumes this project's own `nginx` + `certbot` services own
ports 80/443. If your server already has a **different**, pre-existing
nginx running directly on the host (outside Docker) — already
Certbot-managed for this domain — you don't need to fight it for the ports
or run `deploy/init-certbot.sh` at all. Instead:

1. Don't start this project's `nginx`/`certbot` services — just never
   include them when you `docker compose up` (or `docker compose stop nginx
   certbot` if they're already up).
2. `admin`, `storefront`, and `minio` already publish to `127.0.0.1:7975`,
   `127.0.0.1:3001`, and `127.0.0.1:19000` respectively (see their `ports:`
   in `docker-compose.prod.yml`) specifically for this case — nothing
   external can reach those, only processes on the same host. Neither uses
   its common default port (3000, 9000) — both are very likely already
   taken by something else on a shared server (confirmed true for both on
   a real deployment); change them in `docker-compose.prod.yml` (and the
   nginx config in the next step) if 7975 or 19000 collide with something
   on yours too.
3. Add the `location /admin` / `location /ome-media` / `location /` blocks
   from `deploy/host-nginx-alternative.conf` into your existing host nginx
   config, proxying to those `127.0.0.1` addresses. Keep your existing
   `listen`/`ssl_certificate*` lines and HTTP→HTTPS redirect block as they
   already are — a working Certbot-managed config doesn't need those
   touched. The `/ome-media` block matters even if you don't care about
   images specifically — without it, every presigned S3 URL this app
   generates (product images, invoice/packing-slip PDFs) is signed against
   your public domain but has nowhere to actually land, and 404s/times out
   in the browser.
4. `nginx -t` (or `sudo nginx -t` if the config lives in a root-owned path),
   then reload: `systemctl reload nginx`.

Same "no trailing path after the proxy_pass port" rule applies here as in
`deploy/nginx.conf` — see that file's comments for why.

---

## Why the API isn't public

Both Next.js apps call the backend **server-side** (Server Components /
Server Actions / the storefront's own Route Handlers proxy) — the browser
never talks to `api` directly, and neither app's client-side code holds a raw
JWT. So the API only needs to be reachable on the internal Docker network,
which is both simpler and reduces attack surface. If you later need direct
external API access (a mobile app, inbound payment-gateway webhooks),
uncomment the commented-out `server` block at the bottom of
`deploy/nginx.conf` (needs its own subdomain + certificate — see the block's
own comments) and add an `API_DOMAIN` entry to `.env.production`.

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
