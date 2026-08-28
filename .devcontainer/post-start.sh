#!/usr/bin/env bash
# Runs on every container start, and never during a prebuild — which is why
# the Zitadel bootstrap lives here rather than in postCreate. A prebuild has
# no codespace name, so anything it provisioned would be keyed to the wrong
# domain.
set -euo pipefail

cd "$(dirname "$0")/.."

# Republish the Compose services on this container's own ports; Codespaces only
# forwards what the primary container listens on. Backgrounded — it runs for the
# life of the container, and postStart must not block.
echo "Forwarding Compose service ports into the dev container:"
# setsid, not a bare `&`: postStartCommand's shell is torn down when the hook
# returns and takes an ordinary background child with it. That left nothing
# listening on 8080, so the tunnel bound to Zitadel's own published port
# instead — where nothing repairs the Host header.
setsid nohup node scripts/codespaces-port-forwarder.mjs \
  > /tmp/codespaces-port-forwarder.log 2>&1 < /dev/null &
sleep 2
cat /tmp/codespaces-port-forwarder.log || true
if ! (ss -ltn 2>/dev/null || netstat -ltn 2>/dev/null) | grep -q ":8080"; then
  echo "WARNING: nothing is listening on 8080 — sign-in will fail." >&2
fi

# Both databases, before provisioning: the Zitadel seed inserts an admin row
# into the app DB and needs the schema to exist. Idempotent, so a restart is a
# no-op.
pnpm --filter @org/database db:migrate
pnpm --filter @org/database db:migrate:test

node scripts/codespaces-provision.mjs
