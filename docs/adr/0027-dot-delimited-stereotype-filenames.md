# ADR-0027: Dot-delimited stereotype filenames

- Status: Accepted
- Date: 2026-07-02

## Context and Problem Statement

Stereotype signifiers had accreted in two incompatible shapes. The DDD stereotypes added deliberately over time — `*.root.ts`, `*.value-object.ts`, `*.domain-service.ts`, `*.endpoint.ts`, `*.util.ts` — used a **dot** to separate the concept from its stereotype. But the older stereotypes used a **dash**: `*-command.ts`, `*-query.ts`, `*-repository.ts`, `*-repository-live.ts`, `*-mapper.ts`, `*-id.ts`, `*-errors.ts`, `*-events.ts`, `*-event-adapter.ts`, `*-policies.ts`. Worse, command/query/event **handlers** carried _no_ signifier at all — `approve-device-grant.ts` was a handler only by process of elimination (it sat next to `approve-device-grant-command.ts`).

The dash form is ambiguous: in `api-token-repository.ts` the dashes between `api`, `token`, and `repository` are indistinguishable, so nothing in the name marks where the concept ends and the role begins. A reader (or a tool, or an agent) can't parse the stereotype without a lookup table. The dot form makes the seam explicit and machine-parseable, and the two conventions coexisting in one tree was itself a smell the layout work (ADR-0025/0026) kept bumping into.

## Decision

**Every file in a module stereotype folder is named `<concept>.<stereotype>[.<qualifier>].ts`.** Dots delimit stereotype segments; dashes appear only _within_ a kebab-case concept name.

- **Dashes are word-separators inside a name only** — `api-token`, `find-users`, `stripe-webhook`. Never a stereotype delimiter.
- **Dots delimit the stereotype and any qualifier** — matching the pre-existing `*.root.test.ts` / `*.endpoint.integration.test.ts` pattern (stereotype + qualifier as successive dots).
- **Compound stereotypes keep their internal dash as one segment** — `*.repository-live.ts`, `*.repository-fake.ts`, `*.value-object.ts`, `*.event-adapter.ts`, `*.resource-resolver.ts`, `*.domain-service.ts`. The live/fake of a repository is a single compound stereotype, not a `repository` stereotype with a `live` qualifier.
- **Handlers get an explicit stereotype.** Command/query/event-handler implementations are `*.handler.ts` (the folder — `commands/`, `queries/`, `event-handlers/` — disambiguates which kind). A command is now `<verb-noun>.command.ts` (schema) + `<verb-noun>.handler.ts` (handler).

### The full vocabulary

| Folder                         | Stereotype filenames                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `domain/`                      | `.root` · `.aggregate` · `.entity` · `.value-object` · `.id` · `.errors` · `.events` · `.domain-service`     |
| `domain/ports/repositories/`   | `.repository`                                                                                                |
| `domain/ports/clients/`        | `.client`                                                                                                    |
| `domain/ports/acl/`            | `.acl`                                                                                                       |
| `commands/` · `queries/`       | `.command` / `.query` (schema) + `.handler`                                                                  |
| `event-handlers/`              | `.handler`; `triggers/` → `.triggers`                                                                        |
| `infrastructure/repositories/` | `.repository-live` · `.repository-fake` · `.mapper`                                                          |
| `infrastructure/clients/`      | `.client-live` · `.client-fake` · `.client` (self-contained) · `.email` (tsx)                                |
| `infrastructure/acl/`          | `.acl-live` · `.acl-fake`                                                                                    |
| `interface/http,cli/`          | `.endpoint` · `index.ts` (group-registration barrel) · `.util`                                               |
| `interface/events/`            | `.event-adapter`                                                                                             |
| `policies/`                    | `.policies` · `.resource-resolver(s)` · `.policy` (the `is-*` checks)                                        |
| `policies/public/`             | `.service-live` (this module's Lives of platform ACL service ports)                                          |
| module root                    | `index.ts` · `.module` · `.command-handlers` · `.query-handlers` · `.event-span-attributes` · `.shared-deps` |

Tests append their qualifier to the subject stereotype: `*.handler.test.ts`, `*.repository-live.integration.test.ts`, `*.event-adapter.test.ts`.

### Scope

This applies to the module **stereotype folders** and the **module root** (whose aggregation/composition files — `<feature>.module.ts`, `<feature>.command-handlers.ts`, `<feature>.query-handlers.ts`, `<feature>.event-span-attributes.ts`, `<feature>.shared-deps.ts` — are dotted too, and are the _only_ files the module root admits; `index.ts` stays as the barrel). The module root's platform-ACL service Lives, previously loose files, moved to `policies/public/*.service-live.ts`.

The `platform/`, `common/`, and `test-utils/` trees remain deliberately **excluded**: they hold kernel/wiring/support code with descriptive kebab names, not DDD stereotypes. Forcing a `.stereotype` onto `env-vars.ts` or `unit-of-work.ts` would invent a role that isn't there.

## Enforcement

The layout checker (`lint:layout`) and test-parity checker (`lint:tests`) allowlists and subject globs are expressed in dot-form; the commands/queries pairing rule is now `<base>.handler.ts` ↔ `<base>.command.ts`/`.query.ts`. The dependency-cruiser `dumb-repository-live-no-app-collaborators` path regex and the eslint `dumb-repository-ports` files glob were retargeted from `-repository`/`-repository-live` to `.repository`/`.repository-live`. Because the naming _is_ the detector for both checkers, a file that reverts to a dash suffix fails the build.

## Consequences

- Every file's role is legible from its name without a lookup table, and uniformly so — the dot always precedes the stereotype.
- Handlers are now first-class stereotypes rather than the unmarked residue of a folder.
- The change was a pure rename (~293 files) with no behavior change; correctness rests on typecheck + the test suite + the three checkers, all green.
- Two hazards surfaced and were handled: (1) same-basename files that map to _different_ stereotypes (`organization-events` was both a domain `.events` and a trigger `.triggers`) — the import rewrite had to disambiguate by folder, not basename; (2) a module concept that also names an out-of-scope `platform/` file (`is-org-admin`) — the rewrite must not follow the basename into an untouched tree. Both are inherent to basename-keyed refactors and worth remembering for the next one.

## Alternatives considered

- **Leave the mixed dash/dot status quo.** Rejected — the ambiguity and inconsistency were the problem, and every new stereotype widened the split.
- **Nested-dot compound impls (`.repository.live.ts`).** Considered; rejected in favor of the hyphen-compound (`.repository-live.ts`) so live/fake read as one stereotype alongside `.value-object`/`.event-adapter`, rather than a `repository` stereotype with a `live` qualifier.
- **Explicit `.command-handler.ts` / `.query-handler.ts`.** Rejected as redundant with the folder; `.handler.ts` is unambiguous in context.
- **Extend to platform/common/test-utils.** Rejected — those are not DDD stereotypes; a forced suffix would misrepresent kernel/support files.

## Related

- ADR-0002 (module layout) — the folder vocabulary these filenames populate.
- ADR-0003 (aggregates) — the `.root`/`RootOps` stereotype the dot convention started from.
- ADR-0025 / ADR-0026 (folder-layout enforcement, domain services & interface utils) — the checkers whose allowlists this decision converts to dot-form.
