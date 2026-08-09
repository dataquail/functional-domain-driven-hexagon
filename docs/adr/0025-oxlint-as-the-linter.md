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
pre-dated this migration and behaved identically under ESLint:
`no-cross-schema-slonik-access` matches only a bare `sql` tag, while every
server SQL site uses `sql.type(Schema)`, and its `FROM` pattern cannot match a
quoted schema — which ADR-0020 requires for the `user` schema. ADR-0020's static
enforcement is therefore not currently effective on production code. That is
tracked as its own concern; it is not a regression from this change.

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
