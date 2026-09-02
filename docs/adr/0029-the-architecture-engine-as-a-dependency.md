# ADR-0029: the architecture engine as a dependency

- Status: Accepted
- Date: 2026-09-02

## Context and Problem Statement

ADR-0027 built the engine and ADR-0028 gave it a manifest. Both closed with the
same follow-up: extract it. The engine had been living in `packages/` since it
was written, which was right while its shape was still moving — a rule family and
the policy that exercised it changed in one commit — and wrong once it stopped.

Two costs came from it staying.

**The repo's own gates were measuring the wrong thing.** `packages/` is what
`pnpm lint`, `pnpm check`, `vitest.config.ts` and the coverage thresholds are
pointed at, so the engine's ~4k lines sat inside every number this repository
publishes about itself. A merged coverage figure that folds a lint plugin into a
hexagonal-architecture reference application describes neither.

**Every lint command was a build command.** oxlint loads a plugin with a bare
`import()` and `build/` is gitignored, so `lint`, `lint:fix`, `lint:rules` and
`lint:edges` each ran `tsc -b` on the plugin first. That was the honest fix for a
worse failure — a stale `build/` enforces a stale policy and still lints green —
but it made the fastest gate in the repo depend on a TypeScript build of source
nobody was editing.

Underneath both: a library and a repository that uses it were sharing a version.
There was no way to say "this policy is evaluated by engine 0.1.0-beta.0", and so
no way for a behaviour change in the engine to show up as a diff.

## Decision

Depend on the published engine. `oxlint-architecture-rules` ships from
`dataquail/oxlint-utils` and is installed at the workspace root, pinned to an
exact beta the way `effect` and the `@effect-server-utils/*` packages already
are. `packages/oxlint-architecture-rules/` is deleted.

What moves and what stays is the point:

| Stays here                                             | Moves out                                 |
| ------------------------------------------------------ | ----------------------------------------- |
| `architecture.config.mjs` + the per-area `*.mjs` nodes | resolution, lowering, glob matching       |
| `scripts/lint-rule-probes.mjs`                         | the four rule families                    |
| `scripts/architecture-edges.mjs`                       | the CLI, the baseline, `explain`          |
| `.architecture-baseline.json` (absent — no violations) | the library's own tests and documentation |

The policy is this repository's; the engine that evaluates it is not. That split
is what ADR-0028's follow-up already named, and the manifest was written to
survive it — nothing in `architecture.config.mjs` changes except the JSDoc type
import that gives it completions.

Three seams carry the dependency:

- **The plugin.** `.oxlintrc.json` names the package's `./plugin` export
  directly. The published tarball carries compiled JavaScript, so no lint
  command builds anything and `build:architecture-rules` is gone.
- **The CLI.** `lint:architecture`, `architecture:baseline` and
  `architecture:explain` call the `architecture` bin off `node_modules/.bin`
  instead of a path into a workspace `build/`.
- **The edge table.** `scripts/architecture-edges.mjs` imported three internal
  modules by file path; it now imports `compileImportRules`,
  `evaluateImportEdge`, `lowerManifest` and `makeModuleResolverFake` from the
  package barrel, which is the surface the package publishes for exactly this.

### Consequences

The two anti-vacuity gates get a second job. `pnpm lint:rules` and `pnpm
lint:edges` already prove the policy is armed and says what it means; across a
version bump they also prove the _engine_ still evaluates it the same way. That
is the regression test for an upgrade, and it is why the version is pinned exact
rather than caret — a range would let the engine change under a green build with
no diff to review.

The baseline stays a ratchet and stays empty. A repository adopting the library
from scratch is what `.architecture-baseline.json` exists for; this one has no
violations to record, so the file remains absent.

The engine's files leave `include` in `vitest.config.ts` and its project leaves
`projects`. The merged floors did not move: the remaining suites reach 91.6%
statements, 96.6% branches, 81.7% functions against floors of 90/95/80, so the
ratchet holds on its own terms rather than being re-set to accommodate a smaller
denominator.

### Rejected: keep the source here and publish from it

A `packages/` workspace that also publishes to npm would have kept one-commit
changes to engine-and-policy together. It was rejected because that convenience
is the whole problem: an engine that can be edited to accommodate a policy is an
engine with no contract, and this repository would go on paying for the
library's tests, coverage and build in gates that are supposed to describe an
application.

### Rejected: vendor the built plugin

Committing `build/esm` would have removed the build step without the extraction.
It fails the same way the old arrangement did — a checked-in artifact drifts from
a source nobody diffs — and it forfeits the version number, which is the only
thing that makes an engine change reviewable.

## References

- ADR-0027 — architecture rules as configuration; this ADR completes its
  follow-up, and the engine it describes is now installed rather than vendored.
- ADR-0028 — the architecture manifest; the manifest itself is unchanged and
  stays in this repository.
- ADR-0025 — oxlint as the linter.
