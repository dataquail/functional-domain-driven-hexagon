#!/usr/bin/env bash
# Runs on the Codespaces VM (or your laptop) before Compose creates anything.
#
# This is the only moment at which Zitadel's external domain can still be set:
# Zitadel keys each instance by the host it is reached on and stamps that host
# into the OIDC issuer, and FirstInstance fires on its very first boot. The
# codespace name is not knowable any earlier, and every later hook runs after
# Compose has already started the container.
#
# Pure POSIX-ish bash on purpose: node/pnpm are not guaranteed on the host.
set -euo pipefail

cd "$(dirname "$0")/.."
ENV_FILE=".env"

[ -f ".env.example" ] || { echo "initialize: no .env.example; nothing to do"; exit 0; }
[ -f "$ENV_FILE" ] || cp .env.example "$ENV_FILE"

get_env() {
  grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -n 1 | cut -d= -f2- || true
}

set_env() {
  local key="$1" value="$2" tmp found=0
  tmp="$(mktemp)"
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      "$key"=*) printf '%s=%s\n' "$key" "$value" >> "$tmp"; found=1 ;;
      *)        printf '%s\n' "$line" >> "$tmp" ;;
    esac
  done < "$ENV_FILE"
  [ "$found" -eq 1 ] || printf '%s=%s\n' "$key" "$value" >> "$tmp"
  mv "$tmp" "$ENV_FILE"
}

random_hex() { head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'; }

# Zitadel writes its bootstrap PAT into this bind mount as a non-root UID on
# first boot; if the directory isn't writable for that UID, FirstInstance fails
# and leaves the instance half-initialized.
mkdir -p infra/zitadel/.machinekey
chmod 0777 infra/zitadel/.machinekey

[ -n "$(get_env SESSION_COOKIE_SECRET)" ] || set_env SESSION_COOKIE_SECRET "$(random_hex 32)"

if [ -z "${CODESPACE_NAME:-}" ]; then
  echo "initialize: not a codespace — leaving .env on its localhost defaults"
  exit 0
fi

DOMAIN="${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
WEB_ORIGIN="https://${CODESPACE_NAME}-3000.${DOMAIN}"
ZITADEL_HOST="${CODESPACE_NAME}-8080.${DOMAIN}"
ZITADEL_ORIGIN="https://${ZITADEL_HOST}"

# Service names, not localhost: every container (the dev container included)
# is on the Compose network.
set_env DATABASE_URL       "postgresql://postgres:postgres@postgres:5432/effect-monorepo"
set_env DATABASE_URL_TEST  "postgresql://postgres:postgres@postgres:5432/effect-monorepo-test"
set_env SEED_APP_DATABASE_URL "postgresql://postgres:postgres@postgres:5432/effect-monorepo"
set_env OTLP_URL           "http://jaeger:4318/v1/traces"
set_env MAIL_SMTP_HOST     "mailpit"
set_env SMTP_HOST          "mailpit"

# Browser-facing origins go through Codespaces port forwarding.
set_env APP_URL              "$WEB_ORIGIN"
set_env SERVER_INTERNAL_URL  "http://localhost:3001"
set_env NEXT_PUBLIC_OTLP_URL "https://${CODESPACE_NAME}-4318.${DOMAIN}/v1/traces"

# The forwarder terminates TLS on :443 while Zitadel still speaks plaintext.
set_env ZITADEL_EXTERNAL_DOMAIN "$ZITADEL_HOST"
set_env ZITADEL_EXTERNAL_PORT   "443"
set_env ZITADEL_EXTERNAL_SECURE "true"
set_env ZITADEL_INSTANCE_HOST   "$ZITADEL_HOST"
set_env ZITADEL_ISSUER          "$ZITADEL_ORIGIN"

set_env ZITADEL_REDIRECT_URI             "${WEB_ORIGIN}/api/auth/callback"
set_env APP_REDIRECT_URI                 "${WEB_ORIGIN}/api/auth/callback"
set_env ZITADEL_POST_LOGOUT_REDIRECT_URI "${WEB_ORIGIN}/"
set_env APP_POST_LOGOUT_REDIRECT_URI     "${WEB_ORIGIN}/"

# Port 8080 has to be public for the OIDC back channel to work (see
# docs/codespaces.md), which puts this Zitadel on the open internet for the
# life of the codespace. Shipping the template's well-known password there
# would be an open door, so each codespace gets its own.
if [ "$(get_env ZITADEL_ADMIN_PASSWORD)" = "ChangeMe!1" ]; then
  set_env ZITADEL_ADMIN_PASSWORD "Cs!$(random_hex 12)aA1"
fi
if [ "$(get_env ZITADEL_MASTERKEY)" = "MasterkeyNeedsToHave32Characters" ]; then
  set_env ZITADEL_MASTERKEY "$(random_hex 16)"
fi

echo "initialize: .env pinned to ${CODESPACE_NAME} (web ${WEB_ORIGIN}, zitadel ${ZITADEL_ORIGIN})"
