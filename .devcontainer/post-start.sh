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
nohup node scripts/codespaces-port-forwarder.mjs > /tmp/codespaces-port-forwarder.log 2>&1 &
sleep 1
cat /tmp/codespaces-port-forwarder.log || true

node scripts/codespaces-provision.mjs
