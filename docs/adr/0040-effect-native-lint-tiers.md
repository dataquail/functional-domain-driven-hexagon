# ADR-0040: Effect-native lint — tsgo, oxlint-plugin-effect and anti-slop

- Status: Accepted
- Date: 2026-10-14

## Context and Problem Statement

oxlint already ran `@effect/tsgo`'s recommended preset (ADR-0025), which catches type-aware Effect mistakes:
floating effects, missing channels, leaking requirements. It said nothing about the imperative patterns an
Effect codebase is meant to have left behind: `null` and `undefined` as absence, ternaries, `as` assertions,
`throw`, `try/catch`, `async`/`await`, `process.env`, `JSON.*`, module mocks, and tests that hand-run effects
behind lifecycle hooks. Two rule sets target exactly that. `oxlint-plugin-effect` (cevr/effect-oxlint) is the
syntactic, non-type-aware complement to tsgo. anti-slop (dmmulroy/anti-slop) rejects low-evidence TypeScript:
unknown-typed contracts, widening then asserting, `Reflect.*`, `shape` names, unreadable spacing.

## Decision

All three run with their recommended rules on, at error, inside `pnpm lint`:

| Rule set                    | How it is installed                                                    | Rule ids                                                          |
| --------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `@effect/tsgo` 0.53         | npm, patched into the oxlint binary by `prepare`; `extends` its preset | `effecttsgo/*`                                                    |
| `oxlint-plugin-effect` 0.28 | npm; `extends` its `presets/recommended.json`                          | `effect/*`, native `complexity`                                   |
| anti-slop                   | vendored at `tools/oxlint/anti-slop/` (its distribution model)         | `anti-slop/*`, `anti-slop-effect/*`, `oxc/no-accumulating-spread` |

- tsgo 0.53 patches only oxlint 1.83 and later, so oxlint moved to 1.88 and `@oxlint/plugins` is pinned to the
  same exact version, since the vendored anti-slop imports it.
- anti-slop's provenance and the one local deviation (consecutive re-exports may stay grouped, so its spacing
  fix stops fighting `simple-import-sort/exports`) live in `tools/oxlint/anti-slop/UPSTREAM.md`.
- `oxlint-plugin-effect` re-ships most anti-slop rules under `effect/*`. Both stay on, because each ships rules the
  other lacks. One fix clears both twins.
- `pnpm lint:rules` probes one rule per plugin, so a plugin that fails to load cannot leave its rules silently
  vacuous. The tsgo probe moved from `global-date`, which left tsgo's recommended preset in 0.53, to
  `floating-effect`.

### What is off, and why

- **`effecttsgo/unstable-api-usage`** (and `unstableApiUsage` in the language-service config). It flags every use
  of `effect/http-api`, `effect/http`, `effect/sql` and `effect/reactivity`, which are this application's whole
  stack. The exact `effect` pin is what absorbs their instability.
- **Host boundaries**, each an override in `.oxlintrc.json` that states the contract it yields to:
  - Playwright (`acceptance`, `test-drivers`): async callbacks, thrown assertions, its own fixtures and lifecycle
    hooks, runner-set `process.env`.
  - The frontend test tiers (web and components tests, `test/**`, stories): Testing Library, MSW and Storybook
    give them a promise contract.
  - SvelteKit hooks and load functions (`packages/web/src/**`, `*.server.ts`): async, and they signal a redirect
    or an error by throwing Kit's own value.
  - Vitest's `globalSetup`: a default-exported async function that runs before any Effect test integration.
  - Storybook's config, which resolves paths with node's modules.

Everything else complies: server, jobs, database and identity tests run through `@effect/vitest` (`it.effect`,
`layer`), and absence is `Option`.

### Consequences for code

- **Absence is `Option`.** `Database.maybeRow` returns `Option<Row>` and `orFail` consumes it. Ports, roots,
  fakes and handlers model absence with `Option`; foreign nullables (rows, SDKs, the DOM) are converted where
  they enter, and `Option.getOrNull` writes a SQL or wire `null`.
- **Schema classes are branded** (`effecttsgo/schema-class-missing-brand`) with
  `{ readonly brand: "<ClassName>" }`. The rule's `unique symbol` form makes an endpoint's inferred type name a
  symbol it cannot reach across the package boundary (TS2527), so the brand is the class's own name instead. The
  brands immediately caught three plain-object payloads handed to `HttpApiClient`, which encodes a
  `Schema.Class` strictly and would have thrown at runtime.
- **Integration tests use `describeServer` / `describeIntegration`** (`test-utils/server-test-runtime.ts`):
  `@effect/vitest`'s `layer`, built once per block with the live clock, with the tables truncated before each
  `it.effect`. `ManagedRuntime` plus `beforeAll`/`beforeEach` is gone, and `DATABASE_URL_TEST` is read through
  `Config`.

## Related

- ADR-0025 — oxlint as the linter, and the tsgo patch this extends.
- ADR-0009 — the testing pyramid, whose integration harness changed shape.
- ADR-0033 — the effect-diagnostics campaign, closed. This change needed no campaign: every finding was fixed in
  the change that turned its rule on.
