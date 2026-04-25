# ADR-0008: Architecture enforcement via dependency-cruiser

- Status: Accepted
- Date: 2026-04-25

## Context and Problem Statement

ADR-0001 through ADR-0005 prescribe a layered architecture: domain at the center, then the orchestration layer, then infrastructure and interface. ADR-0002 prescribes a per-module folder layout. None of that holds without tooling.

A code-review-only enforcement strategy fails predictably. The first time someone imports `infrastructure/` from `domain/` to fix a bug "just this once," the convention erodes. The reviewer who would have caught it is on vacation, or didn't notice, or didn't want to delay the merge. Six months later the rules exist on paper and not in the code.

The forces:

- Rules need to fail fast, in CI, and with a clear error message that says which rule was violated and how.
- Rule authoring should be cheap enough that adding a new rule for a new module is mechanical, not a design exercise.
- Rules should be auditable as a single artifact, not scattered across linter configurations.
- Tests need narrowly-scoped exemptions (e.g. unit tests must be allowed to import fakes from `infrastructure/`); the exemption mechanism should make the exemption obvious, not hide it.

## Decision

A repo-root dependency-cruiser configuration defines forbidden-edge rules. A package script (`pnpm lint:deps`) runs the cruiser over the relevant source roots. The configuration is a single CommonJS file at the repository root, kept under version control and reviewed alongside source changes.

The rules currently enforced fall into the following categories.

### Per-folder isolation (per module)

Each module folder has a positive-allowlist rule that names exactly which paths it may import. Outer folders cannot reach further outward; inner folders are protected from outer ones.

The module folders are siblings: `domain/`, `commands/`, `queries/`, `event-handlers/`, `infrastructure/`, `interface/`. There is no `application/` umbrella — the conceptual "application layer" of hexagonal architecture is split across `commands/` (write-side use cases), `event-handlers/` (write-side reactions to events), and `queries/` (read-side projections), and is expressed as a rule set rather than a folder. See "Why no `application/` folder" below.

The per-folder rules:

- `commands-isolation`: commands may import only their own module's `domain/` and sibling `commands/`, the platform shared-kernel facades (command/query/event buses, transaction runner, `span-attributable`, `domain-event`), and other modules' barrels (events). No infrastructure, interface, queries, or event-handlers. No `@org/contracts`. No `@org/database`. Test files excluded.
- `event-handlers-isolation`: identical constraints to commands. Event handlers are write-side reactions; their dependency profile is the same.
- `queries-isolation`: queries may import their own module's `domain/` (for IDs and value objects) and sibling `queries/`, the platform shared-kernel facades, other modules' barrels, and `@org/database` for direct SQL projection. Queries are read-side and explicitly bypass the domain — there is no aggregate to protect when nothing mutates. They may NOT import commands, event-handlers, infrastructure, interface, or `@org/contracts` (wire types belong in `interface/`). Test files excluded.
- `commands-no-external-beyond-effect`, `event-handlers-no-external-beyond-effect`: only `effect` allowed externally. No drivers, clients, or framework code in write-side use cases.
- `queries-no-external-beyond-effect-and-database`: only `effect` and the workspace `@org/database` package allowed externally.
- `no-infrastructure-to-interface`: infrastructure may not depend on its interface.

The test-file exclusion (`pathNot: "\\.test\\.ts$"`) is encoded inline in each isolation rule so unit tests can pull in fakes from `infrastructure/` and integration tests can use the database directly. The exemption is obvious in each rule body, not hidden in a separate ignore list.

### Domain isolation

Domain code is held to stricter standards than the outer-folder rules require:

- `domain-isolation`: a module's domain may import from itself, the `effect` package, and the small set of cross-cutting domain primitives in `platform/` (the shared kernel for declaring domain events, plus the `SpanAttributesExtractor` type used by per-event extractor signatures). Nothing else.
- `domain-no-external-beyond-effect`: domain code may not depend on any external npm package other than `effect`. No SQL client, no PG bindings, no HTTP framework, no ORM. The domain runtime is pure data and Effect types.

### Why no `application/` folder

In strict hexagonal architecture the application layer is "use cases that orchestrate the domain." Once you carve out the read-side (queries, which legitimately bypass the domain — see `queries-isolation` above), the remaining contents of an application folder are commands and event handlers. Both have identical dependency constraints. An umbrella folder over them adds nesting without distinguishing them from anything else.

Flattening to siblings (`commands/`, `queries/`, `event-handlers/`) buys two things:

1. Rules align with folders 1:1. Each folder name maps to a single isolation rule. Reading `commands-isolation` tells you exactly what `commands/` may depend on. The conceptual write-side / read-side split is enforced at the file-system level rather than via convention.
2. The architectural reality is explicit: queries genuinely aren't part of the same layer as commands. Putting them under `application/queries/` implied a kinship that doesn't exist constraint-wise — queries can touch `@org/database`, commands can't. Sibling folders make this visible.

If long-running orchestrations (sagas, process managers) appear, they get their own sibling folder and their own isolation rule.

### Module barrel-only and barrel content

Each module declares a `module-<feature>-barrel-only` rule: code outside the module's folder may import the module only via its `index.ts`. Reaches into a module's internals from another module are compile-time errors.

`barrel-content-discipline` constrains the barrel itself: `index.ts` may not re-export anything from `infrastructure/` or `interface/` — those are private. The published cross-module surface is therefore: domain types (events, IDs, errors), command/query types (messages dispatched via the bus), handler-registration maps and span-attribute aggregators, and the module's `Live` layer for composition. Other modules see messages and notifications, never raw use case functions or repositories.

### Cross-package boundaries

The contracts package (which is consumable by clients as well as the server) has rules forbidding it from depending on the server or database packages. This keeps the public schema definitions self-contained and shareable.

### General hygiene

- `no-circular`: no circular dependencies.
- `not-to-spec`: production code may not depend on test files.

## Consequences

- Architecture violations fail CI, not code review. The cost of repeatedly explaining the rules drops to zero, and the rules cannot be silently weakened.
- Adding a new module requires adding a `module-<feature>-barrel-only` rule. This is a deliberate prompt to consider whether the new folder is in fact a module (with a public surface and internal layering) or just a colocation of files that should live somewhere else.
- Rules are tightened over time as patterns stabilize. Don't fight a rule by widening it; fight it by changing the design. If a command legitimately needs to reach into infrastructure, that is a smell to investigate (probably a missing port in `domain/`), not a rule to relax.
- Test code is exempt from the per-folder isolation rules (`commands-isolation`, `queries-isolation`, `event-handlers-isolation`). The exemption is encoded inline in each rule (`pathNot: "\\.test\\.ts$"`), not in a separate ignore list — easier to audit and harder to abuse. Tests can therefore pull fakes from `infrastructure/` and use the database directly in integration tests.
- The dependency-cruiser TypeScript resolver requires its own `tsconfig` so that path aliases resolve correctly during analysis. This is a minor maintenance cost; the alternative is silently-passing rules because the cruiser couldn't follow imports.
- The configuration is intentionally one file, not a per-package distribution. A single artifact is easier to read end-to-end than rules scattered across many configs.

## Alternatives considered

- **ESLint custom rules.** Possible, but ESLint's import-resolution story is less robust for monorepos with TypeScript path aliases, and the rule expressivity for "this set of paths may not depend on this other set of paths" is awkward.
- **Build-system enforcement** (e.g. separate TypeScript projects per layer with `references`). Adds significant build complexity and forces the layering to be expressible as a project graph, which it isn't always (the test exemption alone is a problem).
- **No enforcement, rely on code review.** Rejected — discussed above; rules exist on paper, not in the code.

## Related

- ADR-0001 (functional core) and ADR-0002 (module layout) define what the rules enforce.
- ADR-0005 (repository pattern) explains why the test exemption is needed.
- ADR-0009 (testing pyramid) documents the test conventions that interact with the exemption.
