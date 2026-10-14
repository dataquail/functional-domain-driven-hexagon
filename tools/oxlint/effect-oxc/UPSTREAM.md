# effect-oxc provenance

- Source: https://github.com/Effect-TS/effect, `packages/tools/oxc/src/oxlint/` (the private `@effect/oxc` workspace package)
- Commit: `269a7c864351231d42e6e95b7fa8f32050df3691` — the `effect@4.0.2` release this repo pins (`reference/effect`)
- Installed at: `tools/oxlint/effect-oxc/` — `index.ts` and `rules/*.ts`, copied unchanged
- Loaded by: `.oxlintrc.json` `jsPlugins` as `effect-oxc`

## Local deviations

- `index.ts`: the plugin is named `effect-oxc`, not `effect` — `oxlint-plugin-effect` already owns the `effect/*` namespace.
- Config, not code: `no-import-from-barrel-package` checks `effect` only. Effect's own config also checks `@effect/*`, whose packages there publish one module per export; `@effect/vitest` and the platform packages here do not.
