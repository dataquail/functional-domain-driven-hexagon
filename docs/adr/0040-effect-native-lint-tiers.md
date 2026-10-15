# ADR-0040: Effect-native lint — tsgo, oxlint-plugin-effect, anti-slop and Effect's own rules

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

All four run with their recommended rules on, at error, inside `pnpm lint`:

| Rule set                     | How it is installed                                                           | Rule ids                                                          |
| ---------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `@effect/tsgo` 0.53          | npm, patched into the oxlint binary by `prepare`; `extends` its preset        | `effecttsgo/*`                                                    |
| `oxlint-plugin-effect` 0.28  | npm; `extends` its `presets/recommended.json`                                 | `effect/*`, native `complexity`                                   |
| anti-slop                    | vendored at `tools/oxlint/anti-slop/` (its distribution model)                | `anti-slop/*`, `anti-slop-effect/*`, `oxc/no-accumulating-spread` |
| Effect's `@effect/oxc` rules | vendored at `tools/oxlint/effect-oxc/` (a private workspace package upstream) | `effect-oxc/*`                                                    |

- tsgo 0.53 patches only oxlint 1.83 and later, so oxlint moved to 1.88 and `@oxlint/plugins` is pinned to the
  same exact version, since the vendored anti-slop imports it.
- anti-slop's provenance and the one local deviation (consecutive re-exports may stay grouped, so its spacing
  fix stops fighting `simple-import-sort/exports`) live in `tools/oxlint/anti-slop/UPSTREAM.md`.
- `oxlint-plugin-effect` re-ships most anti-slop rules under `effect/*`. Both stay on, because each ships rules the
  other lacks. One fix clears both twins.
- `pnpm lint:rules` probes one rule per plugin, so a plugin that fails to load cannot leave its rules silently
  vacuous. The tsgo probe moved from `global-date`, which left tsgo's recommended preset in 0.53, to
  `floating-effect`.

### Effect's own rules, and the import convention they bring

The five rules the Effect repository lints itself with are vendored from the `effect@4.0.2` tag and registered
as `effect-oxc`, since `oxlint-plugin-effect` already owns `effect/*` (`tools/oxlint/effect-oxc/UPSTREAM.md`).
Three guard code this repo does not have yet: bigint literals, instance members on `Schema.Opaque` classes,
and unused `@internal` exports. Two changed the tree:

- **`no-js-extension-imports`**: imports carry no extension at all — `./x`, `@/modules/x/y` — and every
  package resolves with `moduleResolution: "Bundler"` (`module: "ESNext"`). `NodeNext`'s promise, that an
  import tsc accepts resolves the same way under plain Node, only mattered where Node runs tsc's output, and
  nothing here does: the Workers are bundled by esbuild, web and components by Vite, tests and scripts run
  under vitest and tsx, and the server's `@/` aliases were never Node-resolvable anyway. The two binaries that
  did run tsc output, `org` and `org-mcp`, were broken on Node — the built CLI could not resolve
  `@org/api-client` — so they are now esbuild bundles (`build/bin/main.js`), and `pnpm smoke:bins` (in CI and
  `check:all`) runs both the way a user does. With `allowImportingTsExtensions` off, tsc refuses a `.ts`
  specifier (TS5097) and the rule refuses a `.js` one, so extensionless is the only form either accepts.
- **`no-import-from-barrel-package`**: no import of `effect`'s barrels (scoped to `effect` itself, see
  `UPSTREAM.md`), and no relative import of an `index` file. Every `index.ts` that was more than a re-export
  got a name saying what it is: a module's endpoint registration is `interface/{http,cli}/<feature>.endpoint-groups.ts`,
  a compound primitive is `primitives/<name>/<name>.ts` (the package's `./primitives/*` export follows),
  the migration record is `migrations/registry.ts`, and the web test handler set is `handlers/handler-set.ts`.

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
