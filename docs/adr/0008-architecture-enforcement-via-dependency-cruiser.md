# ADR-0008: Architecture enforcement via dependency-cruiser

- Status: Accepted
- Date: 2026-04-24

## Context and Problem Statement

ADR-0001 through ADR-0005 prescribe a layered architecture: domain at the center, then application, infrastructure, and interface. ADR-0002 prescribes a per-module folder layout. None of that holds without tooling.

A code-review-only enforcement strategy fails predictably. The first time someone imports `infrastructure/` from `domain/` to fix a bug "just this once," the convention erodes. The reviewer who would have caught it is on vacation, or didn't notice, or didn't want to delay the merge. Six months later the rules exist on paper and not in the code.

The forces:

- Rules need to fail fast, in CI, and with a clear error message that says which rule was violated and how.
- Rule authoring should be cheap enough that adding a new rule for a new module is mechanical, not a design exercise.
- Rules should be auditable as a single artifact, not scattered across linter configurations.
- Tests need narrowly-scoped exemptions (e.g. unit tests must be allowed to import fakes from `infrastructure/`); the exemption mechanism should make the exemption obvious, not hide it.

## Decision

A repo-root dependency-cruiser configuration defines forbidden-edge rules. A package script (`pnpm lint:deps`) runs the cruiser over the relevant source roots. The configuration is a single CommonJS file at the repository root, kept under version control and reviewed alongside source changes.

The rules currently enforced fall into four categories.

### Layer direction (per module)

Within each module, dependencies must point inward. Outer layers may depend on inner layers; inner layers may not depend on outer ones.

- `no-domain-to-application`: a module's domain may not import from its application.
- `no-domain-to-infrastructure`: a module's domain may not import from its infrastructure.
- `no-domain-to-interface`: a module's domain may not import from its interface.
- `no-application-to-interface`: a module's application may not import from its interface.
- `no-application-to-infrastructure`: enforced strictly except for `*.test.ts` files (so unit tests can pull in fakes from `infrastructure/`).
- `no-infrastructure-to-interface`: a module's infrastructure may not import from its interface.

### Domain isolation

Domain code is held to stricter standards than the rest of the layered rules require:

- `domain-isolation`: a module's domain may import from itself, the `effect` package, and the small set of cross-cutting domain primitives in `platform/` (specifically the shared kernel for declaring domain events). Nothing else.
- `domain-no-external-beyond-effect`: domain code may not depend on any external npm package other than `effect`. No SQL client, no PG bindings, no HTTP framework, no ORM. The domain runtime is pure data and Effect types.

### Module barrel-only

Each module declares a `module-<feature>-barrel-only` rule: code outside the module's folder may import the module only via its `index.ts`. Reaches into a module's internals from another module are compile-time errors.

### Cross-package boundaries

The contracts package (which is consumable by clients as well as the server) has rules forbidding it from depending on the server or database packages. This keeps the public schema definitions self-contained and shareable.

### General hygiene

- `no-circular`: no circular dependencies.
- `not-to-spec`: production code may not depend on test files.

## Consequences

- Architecture violations fail CI, not code review. The cost of repeatedly explaining the rules drops to zero, and the rules cannot be silently weakened.
- Adding a new module requires adding a `module-<feature>-barrel-only` rule. This is a deliberate prompt to consider whether the new folder is in fact a module (with a public surface and internal layering) or just a colocation of files that should live somewhere else.
- Rules are tightened over time as patterns stabilize. Don't fight a rule by widening it; fight it by changing the design. If application code legitimately needs to reach into infrastructure, that is a smell to investigate, not a rule to relax.
- Test code is exempt from a small set of rules (specifically the application-to-infrastructure ban). The exemption is encoded inline in the rule (`pathNot: "\\.test\\.ts$"`), not in a separate ignore list — easier to audit and harder to abuse.
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
