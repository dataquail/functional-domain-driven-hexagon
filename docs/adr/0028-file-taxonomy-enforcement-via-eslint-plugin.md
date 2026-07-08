# ADR-0028: File-taxonomy enforcement via eslint-plugin-project-structure

- Status: Accepted
- Date: 2026-07-07

## Context and Problem Statement

The hexagonal/DDD file taxonomy — which file kinds a folder admits (layout), which
sibling files a stereotype requires (parity: tests, fakes, stories), and which
subfolders a container admits — was enforced by two hand-rolled Node scripts run
as `pnpm lint:layout` and `pnpm lint:tests`, wired into `check:all` and two
dedicated CI jobs. ADR-0025 introduced the layout checker (deny-by-default file
kinds per stereotype folder); the parity checker predated it and grew alongside
ADR-0008, ADR-0013, ADR-0014, ADR-0015, ADR-0016, and ADR-0026.

Two problems accumulated. First, the taxonomy lived as imperative script logic
(glob arrays, regex allowlists, candidate-path functions) rather than as
declarative config — hard to read as a specification, and invisible in the
editor (violations surfaced only when you remembered to run the scripts or when
CI failed). Second, and increasingly the dominant concern: the primary
contributor to this codebase is now an AI coding agent, and the scripts' error
messages were their most valuable output — a generic "not allowed here" tells an
agent _that_ a file is misplaced, but a message like "model this as a method on
the aggregate root, or add a new stereotype to the taxonomy" tells it _what to
do_, which is what stops it from force-fitting a file into the nearest allowed
stereotype (corrupting the taxonomy) to make the check pass.

The taxonomy is a natural fit for a general-purpose tool. `eslint-plugin-project-structure`
provides a `folder-structure` rule that expresses exactly this — per-folder file
allowlists, subfolder allowlists, and required-sibling assertions — as
declarative config inside the existing ESLint pass.

## Decision

**Re-express the entire file taxonomy as the `project-structure/folder-structure`
ESLint rule, configured in `eslint.project-structure.mjs`, and decommission both
bespoke scripts.** The taxonomy now runs under `pnpm lint` (in-editor + CI); a
single config file is the machine-readable specification of layout + parity for
server modules, web features, the TanStack-query bridge, and the component
library. `dependency-cruiser` keeps the import-boundary job unchanged (ADR-0008);
this ADR only replaces the file-taxonomy job.

This supersedes the **enforcement-mechanism** portions of ADR-0008 (§ test-parity
check), ADR-0013 (§ endpoint parity script), and ADR-0025 (§ layout checker). The
stereotype vocabulary, the required-sibling obligations, and the layering rules
those ADRs define are unchanged — only the tool that enforces them changed. The
historical ADRs are left as point-in-time records.

### How the taxonomy maps onto the rule

- **Layout is deny-by-default.** A folder that enumerates its `children` rejects
  any file or subfolder not matched — this is the layout allowlist. A folder that
  lists only folder-typed child rules (and no file rule) rejects all direct files
  — this expresses the "container admits no direct files" folders (`domain/ports/`,
  `infrastructure/`, `interface/`).
- **Parity is `enforceExistence`.** A rule node can require sibling files, resolved
  against the real filesystem. Because the requirement is an append onto the matched
  file's base name, adapter parity is anchored on the **port**
  (`domain/ports/repositories/*.repository.ts` requires its `-live` / `-fake` /
  `-live.integration.test.ts` in `../../../infrastructure/repositories/`), not on
  the adapter. A consequence — and a benefit — is that a port and its adapters must
  now share a base name; adopting the rule surfaced one latent mismatch (a
  `todo.repository.ts` port against `todos.repository-*` adapters), which was
  corrected. A self-contained client with no port is correctly not required to have
  a live/fake, because the requirement is driven from the port tier where it does
  not appear.
- **Didactic messages.** Each rule carries an optional `message` — the pedagogical
  hint the scripts used to print — emitted for name/type/deny-by-default violations
  and missing-sibling failures. This is the steering surface for human onboarding
  and for the AI agent.

### Decisions folded in

- **Endpoint parity standardizes on `*.endpoint.integration.test.ts`.** The rule
  cannot express "either an integration test or a unit token" (see Consequences),
  so endpoints carry one canonical requirement. The performative "is defined" unit
  tokens for five organization endpoints were replaced with real HTTP integration
  tests. The OIDC `login` and `logout` endpoints — whose happy path needs a live
  identity provider and is covered by Playwright + the session-repository
  integration test — are exempted as two explicitly named rules; `callback` gained
  a real integration test for its reachable no-IdP guard. This matches the endpoint
  test-naming convention (a `*.endpoint.test.ts` is a deliberate token whose
  coverage lives elsewhere).
- **Query handlers require an integration test; event handlers a unit test.** Both
  stereotypes had a genuine mix of `*.handler.test.ts` and
  `*.handler.integration.test.ts` in use, and the `.integration.` suffix is
  load-bearing (CI selects integration tests by filename). Rather than keep a
  residual OR-check, the two stereotypes were standardized: query handlers read real
  SQL projections so their parity is the integration test (the nine fake-based query
  unit tests were rewritten as real database integration tests); event handlers
  keep the unit test.

### Vendored fork

The rule's stock error text is fixed and generic; the per-rule `message` field is
a local addition. We therefore depend on a fork of the plugin, built and committed
as a tarball under `vendor/` and referenced via a `file:` dependency (the upstream
package's entry point is built output with no install-time build step, so a git
dependency would not install cleanly). The fork also carries a small performance
patch that memoizes the rule's per-file config validation. When the upstream
custom-message contribution is released, the `file:` dependency is replaced with
the published package and the vendored tarball removed.

## Consequences

- **Single source of truth.** Layout, parity, and subfolder allowlists are one
  declarative file that reads as a specification and gives in-editor feedback.
- **Concessions.** The rule's `enforceExistence` is AND-only (no "either sibling"),
  which forced the canonical-name standardizations above. The old commands/queries
  "pair rule" (a bare handler admitted only if its schema sibling exists) is
  inexpressible and dropped — deny-by-default still blocks stray-named files, and an
  orphan handler still owes its test. A completely empty stray folder (no linted
  files inside) is not visited by the file-triggered rule, so it escapes; low risk,
  since stray folders almost always contain files.
- **Performance.** The rule runs per linted file; over the full server-module tree
  this adds measurable time to a cold `pnpm lint`. The vendored memoization patch
  mitigates the largest cost (per-file config re-validation). `lint-staged` lints
  only staged files, so pre-commit is unaffected. If a cold CI lint approaches its
  timeout, enabling ESLint's `--cache` (persisted across CI runs) is the mitigation.
- **Single-maintainer dependency.** The plugin is one maintainer's project. The
  fork is sha-pinned, built from source, and committed as a tarball, and the deleted
  scripts remain recoverable from git history — so a stall or abandonment upstream
  does not block us.
