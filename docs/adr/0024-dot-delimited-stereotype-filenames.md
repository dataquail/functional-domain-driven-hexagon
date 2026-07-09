# ADR-0024: Dot-delimited stereotype filenames

- Status: Accepted
- Date: 2026-07-02

## Context and Problem Statement

A stereotype signifier in a filename must be machine-parseable — the layout and parity checkers (ADR-0008) key off it, and a reader (or an agent) should be able to name a file's role without a lookup table. A dash separator is ambiguous: in `api-token-repository.ts` the dashes between `api`, `token`, and `repository` are indistinguishable, so nothing marks where the concept ends and the role begins. Handlers were the worst case — with no signifier at all, a handler was a handler only by process of elimination (sitting next to a `*-command.ts`).

A dot makes the seam explicit and machine-parseable, and matches the pre-existing `*.root.test.ts` / `*.endpoint.integration.test.ts` pattern where a stereotype and its qualifier are successive dots.

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

The `project-structure/folder-structure` layout and parity allowlists (ADR-0008) are expressed in dot-form; the commands/queries handler is `<base>.handler.ts` beside its `<base>.command.ts`/`.query.ts` schema. The dependency-cruiser `dumb-repository-live-no-app-collaborators` path regex and the eslint `dumb-repository-ports` files glob key on `.repository`/`.repository-live`. Because the naming _is_ the detector for these checkers, a file that uses a dash suffix for a stereotype fails the build.

## Consequences

- Every file's role is legible from its name without a lookup table, and uniformly so — the dot always precedes the stereotype.
- Handlers are first-class stereotypes rather than the unmarked residue of a folder.
- Same-basename files that map to _different_ stereotypes are disambiguated by folder, not basename (`organization.events` in `domain/` vs `organization.triggers` in `event-handlers/triggers/`).

## Alternatives considered

- **Leave the mixed dash/dot status quo.** Rejected — the ambiguity and inconsistency were the problem, and every new stereotype widened the split.
- **Nested-dot compound impls (`.repository.live.ts`).** Considered; rejected in favor of the hyphen-compound (`.repository-live.ts`) so live/fake read as one stereotype alongside `.value-object`/`.event-adapter`, rather than a `repository` stereotype with a `live` qualifier.
- **Explicit `.command-handler.ts` / `.query-handler.ts`.** Rejected as redundant with the folder; `.handler.ts` is unambiguous in context.
- **Extend to platform/common/test-utils.** Rejected — those are not DDD stereotypes; a forced suffix would misrepresent kernel/support files.

## Related

- ADR-0002 (module layout) — the folder vocabulary these filenames populate.
- ADR-0003 (aggregates) — the `.root`/`RootOps` stereotype the dot convention started from.
- ADR-0008 (architecture enforcement) — the folder-structure checker whose allowlists are expressed in this dot-form.
- ADR-0022 (adapter taxonomy) and ADR-0023 (domain services & interface utils) — stereotypes this vocabulary names.
