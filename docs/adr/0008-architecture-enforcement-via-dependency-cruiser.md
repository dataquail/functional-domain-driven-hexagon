# ADR-0008: Architecture enforcement via dependency-cruiser and the folder-structure ESLint rule

- Status: Accepted
- Date: 2026-04-25

## Context and Problem Statement

The earlier ADRs prescribe a layered architecture (domain at the center, then the orchestration layer, then infrastructure and interface) and a per-module folder layout (ADR-0002). None of that holds without tooling.

A code-review-only enforcement strategy fails predictably. The first time someone imports `infrastructure/` from `domain/` to fix a bug "just this once," the convention erodes. The reviewer who would have caught it is on vacation, or didn't notice, or didn't want to delay the merge. Six months later the rules exist on paper and not in the code.

Two distinct properties need enforcing, and they call for two tools:

- **Import-graph rules** — "this set of paths may not depend on this other set." This is edge reachability; dependency-cruiser is built for it.
- **File-taxonomy rules** — which file _kinds_ a folder admits (layout), which sibling files a stereotype requires (parity: tests, fakes, stories), and which subfolders a container admits. These are about file _existence_, not edges — dependency-cruiser cannot express them. The `project-structure/folder-structure` ESLint rule expresses exactly this as declarative config.

The forces: rules need to fail fast in CI with a clear message that says which rule was violated and how; rule authoring should be cheap; rules should be auditable as a single artifact; and tests need narrowly-scoped, obvious exemptions.

## Decision

### Import-graph rules — dependency-cruiser (`pnpm lint:deps`)

A repo-root `.dependency-cruiser.cjs` defines forbidden-edge rules, run over the relevant source roots. It is a single CommonJS file, version-controlled and reviewed alongside source changes.

**Per-folder isolation (per module).** Each module folder has a positive-allowlist rule naming exactly which paths it may import. The module folders are siblings — `domain/`, `commands/`, `queries/`, `infrastructure/`, `interface/` — with no `application/` umbrella (see below).

- `commands-isolation`: commands may import only their own module's `domain/` and sibling `commands/`, and the platform DDD kernel (command/query/event buses, unit of work, `span-attributable`, `domain-event`). No infrastructure, interface, or queries. No `@org/contracts`, no `@org/database`. **Foreign module barrels are not importable directly** — a call into another module goes through the consumer's `infrastructure/acl/` adapter (ADR-0022). Test files excluded.
- `queries-isolation`: queries may import their own module's `domain/` (IDs, value objects) and sibling `queries/`, the platform kernel, and `@org/database` for direct SQL projection. They may NOT import commands, infrastructure, interface, `@org/contracts`, or foreign barrels. Test files excluded.
- `commands-no-external-beyond-effect`: only `effect` allowed externally.
- `queries-no-external-beyond-effect-and-database`: only `effect` and `@org/database`.
- `no-infrastructure-to-interface`: infrastructure may not depend on its interface.

**Operation-stereotype privacy (ADR-0003).** The DDD law that an aggregate's internals mutate only through its root is enforced by path rules over the domain operation stereotypes:

- `root-ops-only-from-command-handlers`: a `*.root-ops.ts` (the aggregate's mutation surface) is importable only from its own module's `domain/`, its own `commands/*.handler.ts`, test files, and repository fakes.
- `constituent-ops-domain-private`: `*.entity-ops.ts` / `*.aggregate-ops.ts` / `*.value-object-ops.ts` are domain-private — importable only within their own module's `domain/`.
- `interface-events-isolation`: an event adapter (`interface/events/*.event-adapter.ts`) is bus-only — a positive allowlist admitting only its own module's domain events/ids, its own command schemas, the DDD kernel ports, `platform/ids/`, and (for cross-module events) another module's barrel. It may not reach a repository, domain ops, or `domain/ports/`; the dispatched command owns those. There is no `event-handlers/` folder and no `event-handlers-isolation` rule — a cross-aggregate reaction is this adapter dispatching a command (ADR-0007), not a use-case folder of its own.

The test-file exclusion (`pathNot: "\\.test\\.ts$"`) is encoded inline in each isolation rule so unit tests can pull fakes from `infrastructure/` and integration tests can use the database directly. The exemption is obvious in each rule body, not hidden in a separate ignore list.

**Domain isolation.** Domain code is held to stricter standards:

- `domain-isolation`: a module's domain may import from itself, the `effect` package, the DDD kernel's **contracts** tier (`platform/ddd/contracts/`), and `platform/ids/`. Nothing else.
- `domain-no-external-beyond-effect`: no external npm package other than `effect`.
- `subdomain-isolation`: within a module's `domain/`, each subdomain folder (`domain/<subdomain>/`) is a boundary — a file there may import only its own subdomain (plus the `domain-isolation` allowances). It may not import another subdomain, `domain/domain-services/`, or `domain/ports/`. Cross-subdomain composition is the job of a domain service in `domain/domain-services/` (ADR-0023), the one domain location allowed to reach into more than one subdomain — it is excluded from this rule's `from`. Command handlers, queries, interface, and infrastructure sit outside `domain/` and may consume several subdomains; isolation is a domain-internal boundary.

The shared kernel under `platform/ddd/` is tiered by the principle that decides what the domain may touch: **the domain may depend on shared _types/contracts_, but not acquire and invoke shared _services_.** `platform/ddd/contracts/` holds `DomainEvent`, the `SpanAttributesExtractor` type, and `PersistenceUnavailable` — types the domain merely references; `domain-isolation` allows this folder wholesale. `platform/ddd/ports/` holds `UnitOfWork`, `CommandBus`, `QueryBus`, the event buses, and the cross-module ACL services — services the application ring `yield*`s. A companion rule `ddd-contracts-no-ports` forbids `contracts/` from importing `ports/`, so the contracts tier stays transitively domain-safe.

**Module barrel access.** `module-barrel-only-cross-module` and `module-barrel-only-from-outside` enforce barrel-only import of any module under `src/modules/<name>`; new modules are covered automatically. `barrel-content-discipline` forbids `index.ts` from re-exporting `infrastructure/` or `interface/`. `foreign-barrel-only-from-outbound-adapter` (ADR-0022) restricts which _folders_ may aim at a foreign barrel — only `infrastructure/acl/` and `interface/events/`.

**Repository dumbness.** `dumb-repository-live-no-app-collaborators` keeps `infrastructure/repositories/*.repository-live.ts` from importing use cases or application-tier buses/unit-of-work (ADR-0005).

**Cross-package boundaries.** The contracts package may not depend on the server or database packages, keeping the public schema definitions self-contained and shareable.

**General hygiene.** `no-circular` (no circular dependencies); `not-to-spec` (production code may not depend on test files).

### File-taxonomy rules — the folder-structure ESLint rule (`pnpm lint`)

The hexagonal/DDD file taxonomy — layout, sibling parity, and subfolder allowlists — is one declarative config, `eslint.project-structure.mjs`, enforced by the `project-structure/folder-structure` rule under `pnpm lint` (in-editor + CI). A single config file is the machine-readable specification of layout + parity for server modules, web features, the TanStack-query bridge, and the component library.

- **Layout is deny-by-default.** A folder that enumerates its `children` rejects any file or subfolder not matched — the layout allowlist. This is the inverse of parity: parity asks whether a required sibling exists; layout asks whether a file is allowed to exist at all. It stops convention drift — the stray `session-utils.ts` in a subdomain folder or `todo-helpers.ts` in `commands/` that should have been an aggregate op or a named stereotype. **Container folders** (`domain/`, `domain/ports/`, `infrastructure/`, `interface/`) list only folder-typed child rules, so they admit no direct files: `domain/` admits only its subdomain folders (one per aggregate, holding that aggregate's stereotypes and its `*.repository.ts` port), `domain-services/`, and `ports/` — and `domain/ports/` in turn admits only `clients/` and `acl/` (the repository port having moved into the subdomain folder). Subfolders are allowlisted too: a module admits only `domain/ commands/ queries/ infrastructure/ interface/ policies/`, so a stray `modules/x/helpers/`, `modules/x/event-handlers/`, or `interface/grpc/` fails like a stray file.
- **Parity is `enforceExistence`.** A rule node requires sibling files, resolved against the real filesystem. The requirement is an append onto the matched file's base name, so **adapter parity is anchored on the port**: a subdomain's `domain/<subdomain>/*.repository.ts` requires its `-live` / `-fake` / `-live.integration.test.ts` under `infrastructure/repositories/`. A consequence and a benefit: a port and its adapters must share a base name; a self-contained client with no port is correctly not required to have a live/fake.
- **Didactic messages.** Each rule carries a `message` — a pedagogical hint that tells a contributor (human or agent) _what to do_ ("model this as a method on the aggregate root, or add a new stereotype to the taxonomy"), not just that a file is misplaced. This is the steering surface that stops a file being force-fit into the nearest allowed stereotype.

The required-sibling obligations enforced (create one without its sibling and `pnpm lint` fails):

| When you create…                                              | Sibling required                                                                                                                            |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `domain/<subdomain>/*.root.ts`                                | — (a dumb `Schema.Class` data type; no test obligation)                                                                                     |
| `domain/<subdomain>/*.root-ops.ts`                            | `<base>.root-ops.test.ts` in the same subdomain folder (the ops bag owns the invariants — the parity moves here)                            |
| `domain/<subdomain>/*.specification.ts`                       | `<base>.specification.test.ts` in the same subdomain folder                                                                                 |
| `domain/<subdomain>/*.{entity,aggregate,value-object}-ops.ts` | `<base>.<stereotype>.test.ts` in the same subdomain folder                                                                                  |
| `domain/domain-services/*.domain-service.ts`                  | `domain/domain-services/<base>.domain-service.test.ts`                                                                                      |
| `commands/*.handler.ts`                                       | `commands/<base>.handler.test.ts`                                                                                                           |
| `queries/*.handler.ts`                                        | `queries/<base>.handler.integration.test.ts` (queries read real SQL)                                                                        |
| `interface/{http,cli}/*.endpoint.ts`                          | `<base>.endpoint.integration.test.ts` (login/logout OIDC endpoints exempted — ADR-0013)                                                     |
| `interface/{http,cli}/*.util.ts`                              | `<base>.util.test.ts`                                                                                                                       |
| `interface/events/*.event-adapter.ts`                         | `<base>.event-adapter.test.ts`                                                                                                              |
| `domain/<subdomain>/*.repository.ts`                          | in `infrastructure/repositories/`: `<base>.repository-live.ts` + `<base>.repository-fake.ts` + `<base>.repository-live.integration.test.ts` |
| `domain/ports/clients/*.client.ts`                            | in `infrastructure/clients/`: `<base>.client-live.ts` + `<base>.client-fake.ts` + `<base>.client-live.test.ts`                              |
| `domain/ports/acl/*.acl.ts`                                   | in `infrastructure/acl/`: `<base>.acl-live.ts` + `<base>.acl-fake.ts` + `<base>.acl-live.test.ts`                                           |

The parity obligation for an aggregate root sits on its `*.root-ops.ts` (which owns the invariants), not on the dumb `*.root.ts` data class (ADR-0003). The naming conventions (ADR-0024) are the parity detectors — don't rename a file to dodge the rule, write the test. Because `enforceExistence` is AND-only (no "either sibling"), the taxonomy standardizes on one canonical requirement per stereotype: endpoints require `*.endpoint.integration.test.ts`; query handlers require the integration test (they read real SQL projections); command handlers, ops bags, specifications, and event adapters require the unit test. The old commands/queries "pair rule" (a bare handler admitted only if its schema sibling exists) is dropped as inexpressible — deny-by-default still blocks stray-named files, and an orphan handler still owes its test.

**Vendored fork.** The rule's stock error text is generic; the per-rule `message` field is a local addition, so we depend on a fork built and committed as a tarball under `vendor/` (`file:` dependency). The fork also carries a required upstream performance fix: the stock `*` wildcard compiled to `(([^/]*)+)` — a nested-quantifier that backtracks catastrophically (a single non-matching `.test()` took ~67s); the fix `([^/]*)` has identical glob semantics in linear time and takes whole-repo `pnpm lint` to ~30s. Do not fall back to the stock upstream package until the wildcard fix is released upstream.

### Why no `application/` folder

The application layer is just `commands/` and `queries/`. Read-side queries legitimately bypass the domain and can touch `@org/database`; write-side commands cannot — so the two do not share dependency constraints, and an umbrella folder over them would imply a kinship that isn't there while adding nesting that distinguishes nothing. Keeping them as siblings buys 1:1 rule↔folder alignment and makes the write-side/read-side split explicit at the file system. A cross-aggregate reaction is not a third application folder: it is an inbound adapter under `interface/events/` that dispatches one of the module's own commands (ADR-0007). If long-running orchestrations (sagas, process managers) appear, they get their own sibling folder and isolation rule.

## Consequences

- Architecture violations fail CI, not code review. The rules cannot be silently weakened.
- Adding a new module under `src/modules/` requires no dependency-cruiser config change — the generalized barrel rules cover any new folder automatically.
- Layout, parity, and subfolder allowlists are one declarative file that reads as a specification and gives in-editor feedback.
- Don't fight a rule by widening it; fight it by changing the design. If a command legitimately needs infrastructure, that is a smell (probably a missing port), not a rule to relax.
- Test code is exempt from the per-folder isolation rules via an inline `pathNot`, easier to audit than a separate ignore list.
- A completely empty stray folder (no linted files) is not visited by the file-triggered rule, so it escapes; low risk, since stray folders almost always contain files.

## Alternatives considered

- **A hand-rolled `check-test-parity` / `check-layout` script.** The taxonomy is a natural fit for a general-purpose tool; imperative script logic (glob arrays, regex allowlists) is hard to read as a specification and invisible in the editor. The declarative rule reads as the spec and its didactic messages are the most valuable output for an AI-agent contributor.
- **ESLint custom rules for the import graph.** ESLint's import-resolution story is less robust for monorepos with TS path aliases, and "this set of paths may not depend on that set" is awkward to express. dependency-cruiser is the better tool for edges; ESLint owns the file taxonomy.
- **Build-system enforcement** (separate TS projects per layer). Adds significant build complexity and can't express the test exemption.
- **No enforcement, rely on code review.** Rejected — rules exist on paper, not in the code.

## Related

- ADR-0001 (functional core) and ADR-0002 (module layout) define what the rules enforce.
- ADR-0005 (repository pattern) explains why the test exemption is needed and the dumb-repository rules.
- ADR-0009 (testing pyramid) documents the test conventions that interact with the exemption.
