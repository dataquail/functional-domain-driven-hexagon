#!/usr/bin/env bash
# Deterministic effect v3 -> v4 mechanical migration pipeline.
# Reverts first-party source to HEAD, then re-applies dep-flip + all codemods in order.
# Safe to run repeatedly: every step is idempotent and regenerable on the migration branch.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "› reverting first-party source to HEAD (package.json + codemods are regenerated below)…"
git checkout -- 'packages/**/*.ts' 'packages/**/*.tsx' 'package.json' 'packages/**/package.json' 2>/dev/null || true

echo "› 01 flip deps";                node scripts/codemods/01-flip-deps.mjs           | tail -1
echo "› 02 mechanical renames";       node scripts/codemods/02-mechanical-renames.mjs  | sed 's/^/    /'
echo "› 03 either -> result";         node scripts/codemods/03-either-to-result.mjs    | sed 's/^/    /'
echo "› 04 Context.Tag -> Service";   node scripts/codemods/04-context-tag-to-service.mjs | sed 's/^/    /'
echo "✓ pipeline complete"
