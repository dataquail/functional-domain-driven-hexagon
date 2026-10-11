#!/usr/bin/env bash
# Runs on every container start, and never during a prebuild — which is why
# provisioning lives here rather than in postCreate. A prebuild has no codespace
# name, so the URLs it wrote into .env would belong to no codespace.
set -euo pipefail

cd "$(dirname "$0")/.."

# Republish the Compose services on this container's own ports; Codespaces only
# forwards what the primary container listens on. setsid, not a bare `&`:
# postStartCommand's shell is torn down when the hook returns and takes an
# ordinary background child with it.
echo "Forwarding Compose service ports into the dev container:"
setsid nohup node scripts/codespaces-port-forwarder.mjs \
  > /tmp/codespaces-port-forwarder.log 2>&1 < /dev/null &
sleep 2
cat /tmp/codespaces-port-forwarder.log || true

node scripts/codespaces-provision.mjs
