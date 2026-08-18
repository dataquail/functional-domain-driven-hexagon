#!/usr/bin/env bash
# Dependency install. Runs inside the dev container, and during prebuilds —
# keep everything here codespace-agnostic so a prebuild can cache it.
set -euo pipefail

cd "$(dirname "$0")/.."

sudo corepack enable
corepack prepare "pnpm@$(node -p "require('./package.json').packageManager.split('@')[1]")" --activate

pnpm install --frozen-lockfile

# @org/web resolves @org/contracts through its built ESM (tsconfig paths and
# vitest aliases mirror the runtime exports map), so the tree has to exist
# before anything typechecks.
pnpm --filter @org/contracts build
