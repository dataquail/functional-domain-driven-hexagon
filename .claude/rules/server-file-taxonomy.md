# Rule: server file taxonomy (layout + test parity)

**Scope:** `packages/server/src/` — read before creating any new file kind, test, fake, or stereotype. Enforced by `pnpm lint`.
**Backing ADR:** 0008 (architecture enforcement via the folder-structure rule).

The file taxonomy — layout (which file kinds a folder admits), sibling parity
(required tests/fakes/stories), and subfolder allowlists — is one declarative
config, `eslint.project-structure.mjs`, enforced by the
`project-structure/folder-structure` ESLint rule under `pnpm lint` (in-editor + CI).
It replaced the bespoke `check-folder-layout.mjs` / `check-test-parity.mjs`
scripts (ADR-0008). Each rule carries a didactic `message` telling you _what to
do_, not just that a file is misplaced. To add a genuinely new file kind or
stereotype, declare it in `eslint.project-structure.mjs` — deliberately, not by
working around the check.

**Parity.** If you create any of these without its sibling, `pnpm lint` fails:

| When you create…                            | Write a sibling…                                                                                            |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `domain/*.root.ts`                          | `domain/<base>.root.test.ts` (aggregate roots; the non-root domain stereotypes need none)                   |
| `domain/*.domain-service.ts`                | `domain/<base>.domain-service.test.ts` (domain services carry a test — they're real domain logic)           |
| `commands/*.handler.ts`                     | `commands/<base>.handler.test.ts` (the test sits on the handler)                                            |
| `queries/*.handler.ts`                      | `queries/<base>.handler.integration.test.ts` (queries read real SQL — the parity is the integration test)   |
| `event-handlers/*.handler.ts`               | `event-handlers/<base>.handler.test.ts`                                                                     |
| `interface/{http,cli}/*.endpoint.ts`        | `<base>.endpoint.integration.test.ts` (login/logout OIDC endpoints are exempted — see Endpoint test naming) |
| `interface/{http,cli}/*.util.ts`            | `<base>.util.test.ts` (the test obligation is the anti-drift guard — ADR-0023)                              |
| `interface/events/*.event-adapter.ts`       | `interface/events/<base>.event-adapter.test.ts`                                                             |
| `domain/ports/repositories/*.repository.ts` | in `infrastructure/repositories/`: `<base>-live.ts` + `<base>-fake.ts` + `<base>-live.integration.test.ts`  |
| `domain/ports/clients/*.client.ts`          | in `infrastructure/clients/`: `<base>-live.ts` + `<base>-fake.ts` + `<base>-live.test.ts`                   |
| `domain/ports/acl/*.acl.ts`                 | in `infrastructure/acl/`: `<base>-live.ts` + `<base>-fake.ts` + `<base>-live.test.ts`                       |

Adapter parity is anchored on the **port** (not the adapter), so a repository/client/acl
port and its adapters must share a base name (a self-contained `infrastructure/clients/*.client.ts`
with no port is not required to have a live/fake). The naming conventions are the
parity detectors — don't rename a file to dodge the rule, write the test.

**Layout.** Each stereotype folder admits a closed set of file kinds (ADR-0008);
an unrecognized source file fails. This is the inverse of parity: parity asks
whether a required sibling exists, layout asks whether a file is allowed to exist
at all. It stops convention drift — the stray `session-utils.ts` in `domain/` or
`todo-helpers.ts` in `commands/` that should have been an aggregate op or a named
stereotype. **Container folders** (`domain/ports/`, `infrastructure/`,
`interface/`) admit no direct files — content lives in a tier subfolder. Subfolders
are allowlisted too: a module admits only `domain/ commands/ queries/
event-handlers/ infrastructure/ interface/ policies/`, so a stray
`modules/x/helpers/` or `interface/grpc/` fails like a stray file.

**Concessions** (ADR-0008): the old commands/queries "pair rule" (a `<base>.ts`
handler admitted only if its schema sibling exists) is dropped — deny-by-default
still blocks stray-named files, and an orphan handler still owes its test. A
completely empty stray folder (no linted files) is not visited by the rule, so it
escapes — low risk.
