# ADR-0025: oxlint as the linter

- Status: Accepted
- Date: 2026-08-09

## Context and Problem Statement

ESLint took 30 seconds on a cold run over the 844 linted files. Measured by
disabling rules and then the TypeScript program itself, that decomposed into 4
seconds of syntactic linting, 15 seconds building the program, and 11 seconds
evaluating type-aware rules — so 87% of the cost was type-awareness. In-editor
feedback paid the same price on every keystroke.

The lint config is not incidental to this codebase. It carries the file taxonomy
of ADR-0008, the schema boundaries of ADR-0020, the bus-factory fence of
ADR-0006, and six local rules. Any replacement had to run all of that or it was
not a replacement.

## Decision

Adopt oxlint as the only linter, including its type-aware mode, and delete
ESLint.

Because type-awareness dominated the runtime, a hybrid — oxlint for syntactic
rules, ESLint retained for type-aware ones — was measured and rejected: ESLint
would still build the program and evaluate those rules, landing at roughly 29
seconds against 30. The full oxlint run, type-aware included, is 3.3 seconds.

Type-aware mode runs on tsgolint, which rejects options TypeScript 7 removes and
discovers the nearest tsconfig per file, so the configs had to be cleaned first:
`baseUrl` dropped from fourteen configs, `downlevelIteration` dropped as inert at
`target: ES2022`, and `esModuleInterop` flipped to `true`. That last one changes
emit, not just checking, so it was verified against the unit and integration
suites rather than `tsc -b` alone.

### What the plugin model required

oxlint's config is JSON and its JS plugin support is alpha. Three consequences
shaped the setup:

- The taxonomy stays authored in `project-structure.config.mjs`, where helper
  functions keep the repetitive port/adapter parity rules DRY. A small wrapper
  plugin exposes one rule per taxonomy with its config already bound, so the
  JSON never becomes the source of truth for 24KB of generated structure.
- Overrides have no `ignores`, and a negated glob in `files` widens the match
  rather than narrowing it. Rules that were scoped by exclusion now own their
  exemptions in code, which makes those exemptions testable.
- An override cannot turn off a plugin's rule unless it also declares that
  plugin.

### Rules that did not survive

`no-restricted-syntax` and `naming-convention` are unimplemented. The former
carried three real conventions, which became named local rules —
`prefer-named-exports`, `no-array-push-spread`, `lucide-icon-suffix`. The latter
was dropped rather than reimplemented: it is permissive as configured, reported
nothing, and ADR-0024 plus the taxonomy already constrain identifiers
structurally. `no-use-before-define` is narrower here, flagging genuine
temporal-dead-zone hazards rather than the type-position references ESLint
counted 262 of and then hid behind `--quiet`.

### Vacuity probes

Every architectural rule now runs through an alpha plugin system, where the
failure that matters is not a crash but a rule going silently vacuous — still
configured, still passing, enforcing nothing. A clean run cannot be
distinguished from a clean codebase by inspection.

So each rule has a probe: a file that violates it, written to a path its globs
match, linted, and asserted on. `pnpm lint:rules` runs them, and CI runs it
beside `pnpm lint`.

The probes justified themselves immediately by finding a live vacuity that
pre-dated this migration and behaved identically under ESLint: the third-party
`no-cross-schema-slonik-access` matched only a bare `sql` tag, while every
server SQL site was `sql.type(Schema)`, and its `FROM` pattern could not match a
quoted schema — which ADR-0020 requires for the `user` schema. ADR-0020 was
therefore not statically enforced at all.

It is now. The rule is a local one (`local/no-cross-schema-sql-access`) that
understands quoted identifiers, knows a module can own a schema under a
different name, and does not mistake `unnest(...)` or a CTE for a table. The
third-party plugin is gone. Two probes cover it — a cross-schema read and an
unqualified table — because a rule this easy to write vacuously is exactly the
kind the probes exist for.

### The Effect rules, and why TypeScript stays on 5

`@effect/tsgo` adds type-aware Effect rules to oxlint, but only after
`effect-tsgo patch --oxlint` rewrites the oxlint binary, and its discovery
requires a TypeScript at major >= 7.

Upgrading `typescript` to 7 is not currently possible here, for a reason that
has nothing to do with our code: `typescript@7.0.2` is the native Go build and
exports exactly two things, `version` and `versionMajorMinor`. There is no
JavaScript compiler API and no `tsserver`. Every tool that calls
`require("typescript")` breaks — including `@typescript-eslint/typescript-estree`,
whose latest release still declares `typescript: ">=4.8.4 <6.1.0"`, and on which
both the taxonomy plugin and the data-boundaries plugin depend. Upgrading
outright would take ADR-0008 and ADR-0020 enforcement with it.

Our own code is already TypeScript 7 clean: under a straight `typescript@7.0.2`,
`tsc -b` compiled with zero errors and the whole unit suite passed. Only the
tooling is behind.

So TypeScript 7 is installed under an alias — `@typescript/native` resolving to
`npm:typescript@7.0.2` — which is the second name tsgo's discovery accepts.
`typescript` itself stays at 5.9.3 with its API intact, and the plugins keep
working.

One consequence needs stating because it is silent: the aliased package also
declares a `tsc` binary, so `node_modules/.bin/tsc` becomes the patched
TypeScript 7. `check`, `check:recursive` and `build` therefore invoke
`node_modules/typescript/bin/tsc` by path rather than the shim, which keeps the
compiler an explicit choice. Folding `check:effect` into a TypeScript 7 `tsc`
run remains available later; it was not taken here.

The `recommended` preset is enabled via `extends`, which oxlint honours and
merges with our own rules and overrides — verified by the probes, which still
report all rules firing. `prefer-schema-over-json` is off, carrying over the
same decision already recorded in the language-service plugin config: every JSON
boundary here is a deliberate wire or test seam.

`prepare` reapplies the patch on every install, including
`pnpm install --frozen-lockfile`. Verified from an unpatched tree: without the
patch oxlint refuses to start rather than skipping the rules, and a frozen
install restores it.

### The LSP-based linter

`check:effect` now runs `effect-tsgo diagnostics` instead of the standalone
`effect-language-service` binary. Same diagnostics, same tsconfig plugin config,
a better engine underneath: it checks `packages/jobs/tsconfig.test.json`, which
the previous backend could not — that project was excluded because loading it
standalone tripped a TypeScript-internal failure in the language-service graph
worker.

Errors and warnings gate; `message`-severity diagnostics are reported but do
not. tsgo surfaces 198 advisory suggestions the previous backend did not, and
acting on those is separate work from changing which tool reports them.
Suppression for a single line is `// @effect-diagnostics-next-line <rule>:off`,
which covers both this gate and the matching oxlint `effecttsgo/*` rule — one
directive, both runners.

`effect-tsgo setup` was deliberately **not** run. It proposes two changes this
repo does not want: adding `--typescript` to the patch, which is the compiler
swap declined above, and deleting the `diagnosticSeverity` block from the plugin
config — including `preferSchemaOverJson: "off"` and the reasoning recorded
beside it. The tsconfig plugin therefore still names `@effect/language-service`,
which is what the editor loads.

## Consequences

- `pnpm lint` is 3.3 seconds rather than 30, in editors as well as CI.
- `pnpm lint:rules` joins `check:all` and CI as a distinct gate.
- Six `eslint-plugin-*` packages remain installed — they are loaded by oxlint as
  JS plugins. Their names no longer imply ESLint is present.
- oxlint honours `eslint-disable` comments, including the `@typescript-eslint/*`
  rule names, so existing suppressions were left untouched.
- oxlint takes paths, not globs. The lint scope is the `packages` directory plus
  `ignorePatterns`, which reproduces the previous 844-file set exactly.
- JS plugin support is alpha. The probes are the standing guard against an
  upgrade breaking a plugin quietly.
- The editor runs the same binary. `.vscode/` recommends the oxc extension,
  which starts `node_modules/.bin/oxlint --lsp`, so in-editor diagnostics come
  from the pinned, patched oxlint and the same `.oxlintrc.json` — including the
  JS plugins. oxlint 1.77.0's language server panicked on any JS-plugin
  diagnostic (oxc #25278, fixed in 1.78.0), which is what forced the first bump.
- `oxlint` and `@effect/tsgo` move together: the patch targets one exact oxlint
  version, so a bump is the pair (`1.81.0` with `@effect/tsgo` 0.40.0).
- `no-redeclare` is off. From 1.79.0 oxlint's rule matches ESLint core and
  reports TypeScript declaration merging — `export const X` beside
  `export type X`, the Effect idiom on 74 sites here — and upstream declined to
  change it (oxc #25936) or offer typescript-eslint's `ignoreDeclarationMerge`.
  A real redeclaration is TS2451; the compiler owns it.

## Alternatives considered

- **Hybrid, ESLint for type-aware rules.** Rejected on measurement: ~29 seconds
  against 30, because the program build is the cost.
- **Serialising the taxonomy into `.oxlintrc.json`.** Rejected — it would make
  the JSON authoritative and discard the helpers that keep the parity rules DRY.
- **Keeping `baseUrl` and skipping type-aware mode.** Rejected: that is the
  hybrid, and it forfeits `no-floating-promises`, which matters most in an
  Effect codebase.
- **Reimplementing `naming-convention`.** Rejected as poor value for a fiddly
  rule that reports nothing today.

## Related

- ADR-0008 — the file taxonomy this runs; the rules are unchanged, the runner is not.
- ADR-0020 — per-module schemas, whose static enforcement the probes found ineffective.
- ADR-0006 — the bus-factory fence, now a local rule owning its allowlist.
