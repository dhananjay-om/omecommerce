#!/usr/bin/env bash
# Configures real Gmail / Google Workspace SMTP for order transactional email
# (confirmation, shipment, cancellation, refund) — without it, the backend
# falls back to a log-only simulated sender (no email is actually delivered).
#
# You need a Gmail or Google Workspace App Password, NOT your normal account
# password — Gmail rejects the normal password over SMTP once 2-Step
# Verification is on, which Google requires before it will even offer
# creating an App Password. Create one at:
#   https://myaccount.google.com/apppasswords
# (16 characters, shown with spaces — this script strips them for you.)
#
# Run from the repo root: ./deploy/set-smtp-credentials.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
ENV_FILE=".env.production"

if [ ! -f "$ENV_FILE" ]; then
  echo "!! $ENV_FILE not found — this script configures the PRODUCTION deployment." >&2
  echo "   Run it from the repo root on the server, after your usual git pull." >&2
  exit 1
fi

# Replaces an existing KEY=... line in $ENV_FILE, or appends a new one — safe
# to re-run any time you want to change/rotate credentials later.
upsert_env() {
  local key="$1" value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

read -rp "Gmail / Google Workspace address (e.g. orders@yourstore.com): " SMTP_USER
if [ -z "$SMTP_USER" ]; then
  echo "!! An address is required." >&2
  exit 1
fi

read -rsp "App Password (16 characters — spaces are fine, they'll be stripped): " SMTP_PASS_RAW
echo
SMTP_PASS="${SMTP_PASS_RAW// /}"
if [ -z "$SMTP_PASS" ]; then
  echo "!! An App Password is required." >&2
  exit 1
fi

read -rp "From name shown to customers (optional, e.g. \"Your Store\" — leave blank to just use the address): " FROM_NAME
if [ -n "$FROM_NAME" ]; then
  SMTP_FROM="${FROM_NAME} <${SMTP_USER}>"
else
  SMTP_FROM="$SMTP_USER"
fi

upsert_env "SMTP_USER" "$SMTP_USER"
upsert_env "SMTP_PASS" "$SMTP_PASS"
upsert_env "SMTP_FROM" "$SMTP_FROM"

echo "==> Saved to $ENV_FILE. Restarting the api service to pick it up..."
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"
$COMPOSE up -d api
if [ $? -ne 0 ]; then
  echo "!! restart failed — see the output above" >&2
  exit 1
fi

echo
read -rp "Send a real test email now to confirm the credentials work? [y/N] " REPLY
if [[ "$REPLY" =~ ^[Yy]$ ]]; then
  read -rp "Send the test to which address? " TEST_TO
  $COMPOSE exec \
    -e SMTP_TEST_TO="$TEST_TO" \
    api node -e '
      import("nodemailer").then(async ({ default: nodemailer }) => {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || "smtp.gmail.com",
          port: Number(process.env.SMTP_PORT) || 587,
          secure: (Number(process.env.SMTP_PORT) || 587) === 465,
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
        try {
          const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: process.env.SMTP_TEST_TO,
            subject: "OMEcommerce SMTP test",
            html: "<p>This is a test email from your OMEcommerce store — SMTP is configured correctly.</p>",
          });
          console.log("Sent:", info.messageId);
        } catch (err) {
          console.error("Failed:", err.message);
          process.exit(1);
        }
      });
    '
  if [ $? -eq 0 ]; then
    echo "==> Test email sent — check the inbox (and spam folder) at $TEST_TO."
  else
    echo "!! Test email failed — double-check the address and App Password above, then re-run this script." >&2
    exit 1
  fi
else
  echo "==> Skipped. The next real order confirmation/shipment/cancellation/refund will use these credentials."
fi
