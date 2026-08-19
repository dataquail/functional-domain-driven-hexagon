#!/usr/bin/env bash
# Refuses to run inside a codespace.
#
# The commands this guards drive `docker compose` from the workspace. In a
# codespace that workspace is itself a container, so Compose resolves the
# relative bind paths to container-side paths and hands them to the VM's
# daemon, which creates them as empty directories. The stack then comes back
# with mounts pointing at nothing — and because the services use fixed
# `container_name`s, the damaged containers replace the working ones and the
# codespace fails to start.
set -euo pipefail

[ -z "${CODESPACES:-}" ] || {
  cat >&2 <<'EOF'

  Refusing to run: this drives `docker compose` from the workspace, which
  only resolves correctly on a laptop.

  In a codespace the stack is already running — the dev container is one of
  its services. What you probably want:

    provision / re-run the seed   node scripts/codespaces-provision.mjs
    logs                          docker logs -f effect-monorepo-zitadel
    a clean slate                 rebuild or recreate the codespace

  See docs/codespaces.md.

EOF
  exit 1
}
