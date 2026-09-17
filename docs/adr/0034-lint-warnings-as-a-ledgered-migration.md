# ADR-0034: Lint warnings as a ledgered migration, toward a lint that fails on a warning

- Status: Accepted
- Date: 2026-09-17

## Context and Problem Statement

`pnpm lint` runs oxlint with `--quiet`. The flag hides every rule at `"warn"`, and the effective config has many: the `@effect/tsgo` preset enables 76 Effect rules at that severity, and the repository's own config adds a handful of ordinary ones (`typescript/consistent-return`, `no-use-before-define`, `no-shadow`, the React component-definition rules). None of them fails anything, in the editor or in CI, so the tree carries 739 findings nobody sees: 364 `async-function`, 138 `instance-of-schema`, 128 `global-date`, 34 `process-env`, and fifty-odd from the rest.

ADR-0033 closed a gap of the same shape for the Effect language service's `message` tier by ledgering it as a campaign until every rule reached zero and was raised. This is the same gap one layer out: the oxlint integration of the same language service, plus the ordinary rules, at a severity the lint discards. A rule at `"warn"` that is never read is a rule that is off, and the reason each is still `"warn"` is the backlog.

## Decision

**Ledger every oxlint warning as a goodbones campaign, `lint-warnings`, and close it by making a warning fail the lint.**

The detector is a `report` term that runs the lint itself — `oxlint --type-aware --format unix packages` — and keeps the `Warning` lines by regex, since an error already fails `pnpm lint`. Each hit is keyed `file#Declaration#rule#hash(message)`, anchored on the enclosing declaration, so an entry survives a reformat and the ledger reads per rule. The ledger, `.architecture-campaigns/lint-warnings.json`, was written from what fired on the day of this ADR; `pnpm lint` and `pnpm lint:architecture` fail on a hit it does not carry and on an entry the code no longer produces.

**The report runs the lint without the architecture plugin.** The plugin runs every report as it loads, so a report that ran `oxlint` under the ordinary config would load the plugin, which would run the report, without end. oxlint's `extends` merges `jsPlugins` and cannot remove one, so the config is split: `.oxlintrc.base.json` is everything but the `architecture` plugin and its six rules, and `.oxlintrc.json` extends it and adds them. The report runs against the base. `ignorePatterns` is the one key `extends` does not carry, so both files list it. The editor, `pnpm lint` and lint-staged read `.oxlintrc.json` as before; nothing else names the base.

**The unit of work is a rule, not a file.** A rule reaches zero one of three ways, each recorded where it happens: the fix the warning names, then `architecture campaigns prune`; a `// oxlint-disable-next-line <rule>` where the finding is deliberate; or `"off"` in `.oxlintrc.base.json` with the reason beside it, where the rule does not apply to this repository — `async-function` on every Playwright driver and `global-date` on every test seed are decisions of that kind, and the decision is written once in the config rather than 364 times in the code.

**Closing.** When the ledger is empty, `--quiet` in `pnpm lint` becomes `--deny-warnings`, and the campaign and its ledger are deleted in the same change (`onComplete: remove` makes `check` fail until they are). `pnpm check:effect` goes with them once the Effect rules oxlint gates are confirmed to cover the rules the tsconfig plugin enables; until then it stays, since the two integrations read separate configs.

## Consequences

- A new warning fails `pnpm lint` and `pnpm lint:architecture` and shows in the editor at its position, with the campaign's `how` as the message. The count only falls through `prune` and only rises through `allow` with a reason.
- `pnpm lint` runs oxlint twice — once as the lint, once as the report the plugin reads at load — about four seconds more. `lint:rules`, `lint:edges` and `lint:architecture` each pay the same once.
- A rule turned off in `.oxlintrc.base.json` leaves the ledger as stale entries to prune, the same as a fix: the burn-down reads the decision too.
- `.oxlintrc.json` is now two files. A rule added to the lint goes in the base; only the architecture plugin lives in the top.
