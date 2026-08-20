#!/usr/bin/env bash
# Runs a command only outside a codespace.
#
#   local-only.sh <cmd...>           in a codespace: refuse, exit 1
#   local-only.sh --skip <cmd...>    in a codespace: say so, exit 0
#
# The commands this wraps drive `docker compose` from the workspace. In a
# codespace that workspace is itself a container, so Compose resolves the
# relative bind paths to container-side paths and hands them to the VM's
# daemon, which creates them as empty directories. The stack then comes back
# with mounts pointing at nothing — and because the services use fixed
# `container_name`s, the damaged containers replace the working ones and the
# codespace fails to start.
#
# `--skip` is for steps inside a composite task: a codespace has already done
# the work at container creation, so the step is genuinely unnecessary rather
# than wrong, and failing it would take the whole task down with it.
set -euo pipefail

skip=false
if [ "${1:-}" = "--skip" ]; then
  skip=true
  shift
fi

[ "$#" -gt 0 ] || {
  echo "local-only.sh: no command given" >&2
  exit 2
}

if [ -z "${CODESPACES:-}" ]; then
  exec "$@"
fi

if [ "$skip" = true ]; then
  echo "Skipping in a codespace (already done at container creation): $*"
  exit 0
fi

cat >&2 <<EOF

  Refusing to run in a codespace: \`$*\`
  drives \`docker compose\` from the workspace, which only resolves correctly
  on a laptop.

  Here the stack is already running — the dev container is one of its
  services. What you probably want:

    provision / re-run the seed   node scripts/codespaces-provision.mjs
    logs                          docker logs -f effect-monorepo-zitadel
    a clean slate                 rebuild or recreate the codespace

  See docs/codespaces.md.

EOF
exit 1
