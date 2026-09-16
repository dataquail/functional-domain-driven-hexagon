# ADR-0033: Campaigns, and the Effect diagnostics as a ledgered migration

- Status: Accepted
- Date: 2026-09-16

## Context and Problem Statement

`pnpm check:effect` runs the Effect language service over every leaf tsconfig and fails on an error or a warning. Its `message`-severity findings — the advisory tier the tsgo backend surfaces — are counted and printed and otherwise ignored. On the day of this ADR there were 75 of them across seven rules, most of them `schemaNumber` (a `Schema.Number` where `Schema.Finite` is meant), the rest `unnecessaryPipeChain`, `multipleCatchTag`, `preferTypedSchemaDecoder`, `flatMapConditionalToFilterOrFail`, `lazyEffect` and `catchToOrElseSucceed`.

None of these is a rule we disagree with. The reason none is a warning is the backlog: raising a rule's severity fails the build on every occurrence at once, so the severity stays at `message` and the count drifts. Nothing tells a contributor editing one of those files that it carries a finding, nothing notices when the count rises, and the only way to make progress visible is to grep the gate's output and remember what it said last week.

The problem is not specific to the Effect diagnostics. It is what every incremental migration looks like once it is too big for one change: the work is cut into tickets, and the tickets become the only record of how far it has got.

## Decision

**Adopt goodbones campaigns** (beta.8) and run one, `effect-diagnostics`, over the message-level findings.

A campaign is an object in `architecture.yaml`: a detector, a rationale, a guide, an owner, a definition of done, and a **ledger** — `.architecture-campaigns/<id>.json` — of every place the pattern still occurs. Where a rule says what may never happen, a campaign names what the code is moving away from and refuses to let the count rise unrecorded. `architecture check` fails on a hit the ledger does not carry and on a ledger entry the code no longer produces; the count only rises through `architecture campaigns allow` with a reason and an author, and only falls through `architecture campaigns prune`, which bumps `fixed` and stamps `lastProgress`. The arithmetic (`entries.length === initial + Σ regressions.delta − fixed`) is checked, so a line added by hand fails the build with no git history in the loop.

The detector is a **`report` term**: `scripts/effect-diagnostics-report.mjs` prints one line per diagnostic across every project, deduplicated (a project's program includes its references' files, so the same finding is otherwise reported under several tsconfigs), and a regex keeps only the `message`-severity lines. Each hit is keyed `file#Declaration#rule#hash(message)`, anchored on the enclosing declaration through the ast-grep matcher rather than on a position, so an entry survives a reformat and the ledger reads per rule. `check-effect-diagnostics.mjs` shares the collector; its behaviour is unchanged.

Three properties of the detector decided its shape:

- **`command`, not `file`.** The term could read a report an earlier step wrote, which is the predictable form for a slow tool. The diagnostics take about four seconds run four projects at a time, and a report file is one more thing to be stale in the editor; the command runs once per process, which is once per `check`, once per `pnpm lint`, and once per editor session.
- **Every message-level rule, not a list.** The term names no `codes`, so a rule the next language-service bump adds is growth like any other — recorded with `allow` and the bump as the reason, or fixed in the same change — rather than quietly outside the campaign.
- **`onComplete: remove`.** The campaign's definition of done is not zero hits; it is every rule raised to `"warning"` in `tsconfig.base.json` so that `check:effect` gates it. A rule at zero whose severity has not been raised is a rule that can silently regrow; `remove` makes `check` fail once the campaign is complete until it and its ledger are deleted, so the last step is not forgotten.

The oxlint plugin gains the sixth rule, `architecture/campaigns`, which reports each unledgered hit at its position in the editor; `pnpm lint:rules` probes it by planting a file the language service flags, the one probe that runs the real report.

## Closing the campaign

1. Fix a finding; `pnpm lint:architecture` reports the entry as stale; `pnpm exec architecture campaigns prune effect-diagnostics packages` deletes its line and bumps `fixed`. A pull request that fixes three findings is a three-line deletion a reviewer can read.
2. When a rule's count reaches zero, raise it to `"warning"` under `diagnosticSeverity` in `tsconfig.base.json`. Its lines leave the report, and a recurrence fails `check:effect` as a warning rather than the campaign as growth.
3. When every rule is gated the ledger is empty, `check` names the campaign complete, and the campaign and `.architecture-campaigns/effect-diagnostics.json` are deleted together.

A rule the repository decides against — `preferSchemaOverJson` is already `off` — is turned off in the same plugin config, and its findings leave the report the same way.

## Consequences

- Message-level Effect findings can no longer grow unnoticed: a new one fails `pnpm lint:architecture` and shows in the editor, and the ledger's diff is the burn-down.
- `pnpm lint`, `pnpm lint:rules` and `pnpm lint:architecture` each run the Effect diagnostics once, about four seconds. `check:all` already ran them; it now runs them twice.
- goodbones moves from beta.6 to beta.8: the TypeScript pack reads facts through oxc-parser (`oxlint` and `oxc-parser` are paired versions; the pin on `oxlint` 1.81.0 is now load-bearing for the plugin's parity), and both hosts take `@goodbones/ast-grep` as the syntax matcher.
- A stalled campaign — no progress for `staleAfter` (30 days) — is a notice in `check` and the first line of `pnpm architecture:conformance`, not a failure. Whether to ratchet that is a later decision.
