# Vendored dependencies

## `eslint-plugin-project-structure-3.14.3-perf.tgz`

A locally-built tarball of a **fork** of
[`eslint-plugin-project-structure`](https://github.com/Igorkowalski94/eslint-plugin-project-structure),
pinned until our upstream contribution merges.

- **Fork:** `github.com/zacharyweidenbach/eslint-plugin-project-structure`
- **Branch / commit:** `feat/folder-structure-custom-message` @ `947ec95` + local patches not yet pushed (the WILDCARD_REGEX perf fix + message plumbing + caches). Push these to the fork branch before opening the upstream PRs.
- **Upstream PR:** https://github.com/Igorkowalski94/eslint-plugin-project-structure/pull/56
- **What the fork adds:**
  1. An optional per-rule `message` field on `folder-structure` rules, emitted for
     name/node-type/deny-by-default violations and `enforceExistence` misses. This
     didactic text is the steering surface that lets the plugin replace our bespoke
     `check-folder-layout.mjs` / `check-test-parity.mjs` scripts without losing their
     instructional hints. Fully backwards-compatible (no `message` → stock behavior).
  2. **A critical performance fix (a real upstream bug).** Stock `WILDCARD_REGEX`
     (`src/consts.ts`) was `"(([^/]*)+)"` — a nested quantifier (`(...)+` around
     `[^/]*`) that catastrophically backtracks. Every `*` in a rule compiles to it,
     and on a long non-matching filename (e.g. testing
     `create-todo.handler.integration.test.ts` against `*.repository-live.integration.test.ts`)
     a single `.test()` takes **~67 SECONDS**. With a large config (many `*` rules)
     matched against many files, `pnpm lint` effectively hangs (we saw multi-hour runs).
     Changed to `"([^/]*)"` (identical glob semantics, linear time) → the full
     folder-structure lint drops from hours to ~1.5s; whole-repo `pnpm lint` ~32s.
     **This is the fix that makes adoption viable and is the priority upstream PR.**
  3. Minor: `validateConfig` memoizes JSON-schema validation and `validateName`
     caches compiled regexes (both keyed so they compute once) — small extra wins.

### Why a tarball (not a `github:` dependency)

The upstream package's entry point is `dist/index.js`, and the repo has **no `prepare`
script**, so `pnpm add github:…#sha` would install unbuilt source and the plugin would
fail to load. The tarball is built (`tsup`) and packed ahead of time, so installs are
deterministic and require no build step in CI.

### How it was built

```sh
git clone -b feat/folder-structure-custom-message \
  https://github.com/zacharyweidenbach/eslint-plugin-project-structure.git
cd eslint-plugin-project-structure
yarn install && yarn build   # tsup → dist/
npm pack                     # → eslint-plugin-project-structure-3.14.3-perf.tgz
```

Referenced from root `package.json` as:

```jsonc
"eslint-plugin-project-structure": "file:vendor/eslint-plugin-project-structure-3.14.3-perf.tgz"
```

### Exit criteria (remove this vendor)

When upstream PR #56 merges and is released, replace the `file:` dependency with the
published `eslint-plugin-project-structure@^3.x`, delete this tarball, run
`pnpm install`, and run the folder-structure fault-injection sweep once to confirm the
custom-message behavior is unchanged.
