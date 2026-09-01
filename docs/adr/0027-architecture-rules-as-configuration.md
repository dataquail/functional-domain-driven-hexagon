# ADR-0027: architecture rules as configuration, in one oxlint plugin

- Status: Accepted
- Date: 2026-08-31

## Context and Problem Statement

Architectural enforcement lived in three engines that did not talk to each other:

| Engine                                                 | Count     | Cost                                                               |
| ------------------------------------------------------ | --------- | ------------------------------------------------------------------ |
| `.dependency-cruiser.cjs`                              | 41 rules  | its own binary, its own run (`pnpm lint:deps`), its own resolution |
| `eslint-plugin-project-structure` (`folder-structure`) | 4 configs | a **vendored fork** tarball pinned to an unpushed branch           |
| `scripts/lint-rules/` (oxlint `local` plugin)          | 14 rules  | hand-rolled AST walks, several only filling gaps in oxlint         |

An earlier plan treated these as three separate extraction problems and declared
the dependency-cruiser rules "not extractable — project-specific policy, not
mechanism." That framing was wrong. All three do the same thing: _match a fact
about a file — its path, its imports, its declared members — against a policy, and
report a didactic message._ Only the fact-gathering differs.

Two objections had to be answered before consolidating.

**Graph reachability.** A per-file lint rule has no dependency graph, so it cannot
detect cycles. Of the 41 rules exactly one needed the graph (`no-circular`), and
oxlint ships `import/no-cycle` natively.

**Resolution.** dependency-cruiser's value is not its rule syntax; it is that
`tsPreCompilationDeps` resolves every import to a real file, so `@org/contracts/Policy`,
`../../Policy.js` and `node_modules/.pnpm/…/effect/dist/Schema.js` all match as the
file they are. A rule engine matching import _specifiers_ — which is what
`eslint-plugin-project-structure`'s `independent-modules` does — is a weaker thing
wearing the same shape. This was the real requirement.

## Decision

Express architecture policy as **configuration** in `architecture.config.mjs`,
enforced by one oxlint JS plugin, `@org/oxlint-architecture-rules`, that resolves
every import with `unrs-resolver` (the same native resolver oxlint uses
internally) before matching. Delete dependency-cruiser and the vendored fork.

Four rule families, one config, one command:

| Rule                     | Question it answers                                      | Replaced                                                                        |
| ------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `architecture/imports`   | may this file import that one?                           | 41 dependency-cruiser rules                                                     |
| `architecture/exports`   | may this file import _that name_ from it?                | `local/bus-factories-at-composition-roots`, `local/no-effect-namespace-imports` |
| `architecture/members`   | may this file declare or call that name?                 | `local/dumb-repository-ports`, `local/view-hooks-allowlist`                     |
| `architecture/structure` | may this file exist here, and what siblings does it owe? | the vendored `project-structure/folder-structure` fork (4 configs)              |

`exports` is the family a path rule cannot express: every importer of a barrel
resolves to the same file, so only the imported _name_ separates a bus factory
from the Tag beside it. It carries one named autofix strategy,
`subpath-namespace-import`, which preserves the rewrite the Effect rule had.

The 41 import rules ported mechanically: dependency-cruiser's `from`/`to`/`path`/`pathNot`
shape maps one-to-one onto `from`/`fromNot`/`to`/`toNot`, `$1`..`$9` backreferences
included, and each rule's hand-written `comment` became its `message` verbatim.
`dependencyTypes: ["npm", …]` became `dependencyKind`. `no-circular` became
`import/no-cycle`.

### Every rule carries a probe, and the plugin refuses to load without one

The failure mode that matters is not a crash. It is a rule going silently vacuous
— still configured, still passing, enforcing nothing — which a clean lint run
cannot distinguish from a clean codebase. PR #132 fixed exactly that in
`local/no-deep-relative-imports`, which had been enforcing nothing on two of its
three configured scopes.

So every rule in `architecture.config.mjs` carries a `probe`: one synthetic edge
it must report. The plugin evaluates all of them at load and **fails the lint run**
if any rule does not report its own probe. Vacuity is no longer something a probe
script might catch later; it is a load-time error.

`scripts/lint-rule-probes.mjs` keeps the other half — that the plugin is loaded,
the rule id is enabled, its globs match, and resolution is live.

### An unresolved import is an error

dependency-cruiser reports an unresolvable import as `unknown` and moves on,
which voids every path rule about that target. The plugin fails instead. This is
the same principle as the probe: failing open disarms rules without changing a
line of config.

## Consequences

**Porting surfaced four real blind spots** in the old rules, all closed:

1. `node:crypto` classified as `core` in dependency-cruiser, so `dependencyTypes: ["npm", …]`
   never saw it. Modeled here as its own `dependencyKind: "builtin"` — preserving
   the old semantics rather than accidentally tightening them.
2. `domain-no-external-beyond-effect` never fired on test files importing
   `@effect/vitest`, because a root devDependency classifies as `npm-no-pkg` — a
   grade the rule's list omitted. The rule now excludes test files explicitly, as
   every other isolation rule already did. The intent is stated rather than
   inherited from a resolver quirk.
3. The taxonomy declared no `event-handlers/` folder, so the fork **rejected** one
   as a stray folder — even though ADR-0002 and the module-layout rule both tell
   you to create it. The folder and its handler-test parity are now declared.
4. Nine folder rules referenced `MSG.portsContainer`, `MSG.infraContainer` and
   `MSG.interfaceContainer`, none of which the config defined. They were passing
   `undefined`, so those nine rules had been emitting stock text with no didactic
   message at all. Written out as part of the port.

**One command, one config.** `pnpm lint:deps` and the `Dependency rules` CI job
are gone; `pnpm lint` runs the file taxonomy and the import boundaries together
in ~3.3 seconds, unchanged from before.

**The plugin is compiled JavaScript.** oxlint loads plugins with a bare
`import()` and Node 22.14 does not strip types, so `pnpm lint` builds the package
first. A stale `build/` would enforce a stale policy and still lint green — the
vacuity failure in a different disguise — so that build is deliberate, not
incidental.

**Four rule ids, not fifty.** `architecture/imports` is one oxlint rule; each
policy rule's name rides in the message (`[domain-isolation] …`). This keeps
`.oxlintrc.json` to one line per family. Per-violation suppression is the
baseline's job, not `oxlint-disable`'s, so per-policy rule ids would buy little.

**oxlint's JS plugin API is alpha.** The engine's core is adapter-free — pure
functions over `(path, resolved target)` — so the policy survives an API break;
only `src/adapters/oxlint/` would change.

## Alternatives considered

- **Keep dependency-cruiser, extract only the taxonomy.** Rejected: it leaves two
  engines, two resolution configs, and two commands in place, and the taxonomy
  rewrite is the highest-risk half. Doing the import half first gave a diffable
  oracle to gate against.
- **`eslint-plugin-project-structure`'s `independent-modules`.** Rejected. It
  matches specifiers rather than resolved files; `findModuleConfig` returns the
  **first** matching module, so each file gets exactly one allowlist and one
  message where the 41 rules give a handler eight distinct didactic messages; and
  adopting it would deepen dependence on the vendored fork this repo is trying to
  retire. Its `{family_N}` reference does cover the `$1` cases, and that idea is
  worth remembering, but it approximates captures rather than using them.
- **Reuse dependency-cruiser as a library, driven from oxlint.** Rejected: it
  builds the whole graph per run, which is the cost the per-file model avoids.

### What porting the taxonomy simplified

The nested config's most fragile property was that a specific pattern had to beat
a `*` catch-all — the mechanism behind both the OIDC endpoint exemption and the
domain-services/ports/subdomain split. The flat model has no precedence at all:
an exemption is a `fileNot` on the parity rule that would otherwise fire, and a
folder that is not a subdomain is a negative lookahead in that rule's own
`folder` pattern.

The Step-4 gate was fault injection, not a clean-vs-clean diff: every one of the
40 taxonomy probes was planted on disk and linted by both engines. 38 agreed
exactly. The 2 that did not are the `event-handlers/` gap below.

## Follow-ups

A ratcheting baseline (`fingerprintOf` is in place for it) would let the package
be adopted by a repo that is not already clean, and the CLI adapter would let the
policy run with no linter at all. Neither is needed here yet. After that, extract
to `dataquail/oxlint-architecture-rules` and depend on a pinned beta.

## References

- ADR-0008 — architecture enforcement; this ADR replaces its dependency-cruiser half.
- ADR-0025 — oxlint as the linter; this ADR extends its plugin model.
