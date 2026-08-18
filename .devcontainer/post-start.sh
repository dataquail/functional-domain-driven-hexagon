#!/usr/bin/env bash
# Runs on every container start, and never during a prebuild — which is why
# the Zitadel bootstrap lives here rather than in postCreate. A prebuild has
# no codespace name, so anything it provisioned would be keyed to the wrong
# domain.
set -euo pipefail

cd "$(dirname "$0")/.."
node scripts/codespaces-provision.mjs
