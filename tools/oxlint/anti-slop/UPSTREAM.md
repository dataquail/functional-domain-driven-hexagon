# anti-slop provenance

- Source: https://github.com/dmmulroy/anti-slop
- Commit: `13909c9e07590f5a85d93c62712259fe14a883f7` (copied from `skills/install-anti-slop/assets/anti-slop/` by its `install.mjs`)
- Installed at: `tools/oxlint/anti-slop/` — `index.ts` (generic rules, `anti-slop/*`) and `effect/index.ts` (`anti-slop-effect/*`)
- Loaded by: `.oxlintrc.json` `jsPlugins`; `@oxlint/plugins` is pinned to the same exact version as `oxlint`

## Local deviations

- `rules/require-readable-spacing.ts`: consecutive re-exports (`export … from`, `export * from`, single- or multi-line) may stay grouped, like imports. Without it the rule's fix and `simple-import-sort/exports`' fix undo each other.
