# Rule: architecture rules (the manifest)

**Scope:** the whole repo — read before adding, changing, or removing an architectural check.
**Backing ADRs:** 0008 (architecture enforcement), 0025 (oxlint as the linter), 0027 (architecture rules as configuration), 0028 (the manifest), 0029 (the engine as a dependency).

Architectural enforcement runs entirely inside `pnpm lint`, from one file.

| Where                                               | What it owns                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------------ |
| `architecture.config.mjs`                           | resolve, aliases, the repo-wide `deny`/`exports`, and the composed tree        |
| `packages/architecture.mjs`                         | the six leaf packages, and the frontend test node both web tiers share         |
| `packages/{server,web,components}/architecture.mjs` | that package's own nodes, beside its own code                                  |
| `oxlint-architecture-rules` (npm)                   | the engine: resolution, lowering, matching, the anti-vacuity guard             |
| `scripts/lint-rule-probes.mjs`                      | `pnpm lint:rules` — each rule id still fires on a planted violation            |
| `scripts/architecture-edges.mjs`                    | `pnpm lint:edges` — the policy still refuses and allows what it is supposed to |
| `scripts/lint-rules/`                               | the eight hand-rolled `local/*` AST rules that are not boundary rules          |

**The engine is an installed dependency, not source here.** It ships from
`dataquail/oxlint-utils` as `oxlint-architecture-rules`, pinned to an exact beta
in the root `package.json`, and its reference documentation lives with it. This
repo owns the **policy** — the manifest, the probes, the edge table — and nothing
below describes the library. Changing how a rule family behaves means a release
there, not an edit here (ADR-0029).

**One policy, several files; one evaluation.** Each area writes its own nodes and
the root composes them. Do **not** split the _run_ to match: a rule fires when the
checker visits the **importing** file, so a per-package check would silently
disarm every rule whose importer lives on the other side — the repo-wide
prohibitions, which must reach every file, and every `importedBy`. One config,
one baseline, one `explain`, one CI step. The per-area files are `.mjs` and
ignored by oxlint: a file that states the policy is not source the policy governs.

## The manifest

It reads like a directory listing. A key ending in `/` is a folder, anything else
is a file, and everything the architecture says about a part of the tree is
written **at that part of the tree**:

```js
"@/modules/{module}/domain/{subdomain}/": {
  message: "…what this folder admits…",
  imports: { reset: true, message: "…", external: ["effect"], allow: ["…"] },
  children: {
    "*.root.ts": {},
    "*.repository.ts": {
      requires: ["../../infrastructure/repositories/{base}-live.ts", …],
      importedBy: { message: "…", allow: ["@/modules/*/commands/**", …] },
      members: [{ subject: "type-members", in: "*Repository*", allow: […] }],
    },
    "*.aggregate-ops.ts | *.entity-ops.ts | *.value-object-ops.ts": constituentOps,
  },
},
```

| Field        | Question it answers                             |
| ------------ | ----------------------------------------------- |
| `imports`    | what may this reach?                            |
| `importedBy` | who may reach this?                             |
| `members`    | which names may it declare or call?             |
| `requires`   | which siblings does this file owe?              |
| `children`   | which files and folders does this folder admit? |

Repo-wide statements — prohibitions that hold everywhere, and restrictions on
who may import a given exported symbol — sit at the top level as `deny` and
`exports`.

## Naming

`children` says which stereotypes a folder admits; `name` says what the concept
name in front of the stereotype may look like — the degree of freedom a taxonomy
alone leaves open, and the one an agent drifts through first. It takes
`"kebab-case"`, `"camelCase"`, `"PascalCase"`, `"snake_case"`, `{ regex, message }`
or `{ like: "{capture}" }`, and it **inherits like `imports`**, so a tier states it
once.

A file's concept name is its basename up to the **first dot** — `todos` in
`todos.repository-live.ts` — not what a `*` matched, which would swallow a
compound stereotype. A folder node's `name` also judges its own segment when its
key declares a capture, which is what refuses a module folder named `Todos_V2`.

`{ like: "{subdomain}" }` on `domain/{subdomain}/*.root.ts` is the cross-reference
the other forms cannot express: a subdomain folder is the aggregate, so `todo/`
holds `todo.root.ts`. This repo declares kebab-case for the server, web,
components, jobs, cli, mcp and api-client; PascalCase for `contracts/src`
(Effect-style module names); and two regexes carrying a named exception each —
`Database.ts` and `features/__root/`.

## Patterns

Globs over repo-relative paths, matched against **fully resolved** targets:

|          |                                                        |
| -------- | ------------------------------------------------------ |
| `*`      | part of one path segment                               |
| `**`     | any number of segments; `a/**` matches `a` itself      |
| `{name}` | captures one segment in a key; refers back to it below |
| `[A-Z]`  | a character class, passed through as written           |
| `a \| b` | several patterns sharing one node                      |

A `{capture}` may **not** appear in `importedBy.allow`: that list is matched
against the importing file, while the capture was declared by this file's path.
The compiler refuses it rather than emit an exemption that silently never
matches.

## Tight by default; laxity is opted into by name

A folder admits only the children it lists; a file may import only what it or an
ancestor allows. Three escape hatches, all greppable:

- **`reset: true`** — stop inheriting ancestors' allowances.
- **`unrestricted: true`** — this tier has no allowlist yet. Required whenever a
  node states `imports` without an `allow`, so an untightened tier is a sentence
  someone wrote rather than a gap nobody noticed.
- **`layout: "open"`** — this folder does not enumerate its file names. It still
  claims the folder, so the taxonomy root does not fire.

**Prohibitions are the exception.** A `deny` is emitted once over the subtree
that declares it and always accumulates, so no node can make a subtree quieter
than its ancestors. An exemption to a prohibition is declared _by the
prohibition_ (`except`, `matchNot`) — never by the tier escaping it.

## Every rule proves itself

The manifest compiles to flat rules, each with a probe generated from its own
node path. **The plugin refuses to load if any rule fails its own probe.** A rule
that has drifted into matching nothing is the failure this whole apparatus
exists to prevent, and it is now a load-time error rather than something a
separate script might notice later.

Two gates back that up, and they answer different questions:

- `pnpm lint:rules` — the **wiring**: the plugin is loaded, each rule id is
  enabled, its globs match, resolution is live.
- `pnpm lint:edges` — the **semantics**: 166 edges with expected verdicts, 124
  refused and 42 allowed. The allowed rows matter as much: a policy that refuses
  everything is as broken as one that refuses nothing. Every row was verified
  against the dependency-cruiser-era config before the manifest replaced it, so
  a row that changes verdict is either a regression or a decision.

## Resolution

`resolve.scopes` maps a file pattern to the tsconfig whose `paths` resolve it.
The catch-all scope (`files: ""`) comes last. Those tsconfigs carry
**extensionless** path targets: a mapped target is a template, so `@/x/y.js`
against a `.js`-suffixed mapping looks for `y.js.js`; the resolver maps `.js` to
`.ts` on the specifier itself.

**An unresolved import is a hard lint error**, not a skip — an import nobody can
resolve is an import no rule can police, so failing open would disarm every rule
about that package at once without changing a line of config.

## The CLI, and the baseline

The package ships a second way to ask the same question:

```
pnpm lint:architecture              # check, with no linter in the loop
pnpm architecture:baseline          # record the violations this repo carries
pnpm architecture:explain <file>    # what governs this file, and why
```

oxlint's JS plugin API is alpha, and a policy that only one alpha host can
evaluate has a single point of failure. The CLI covers **all four families**: it
reads TypeScript's syntax tree where the plugin reads oxlint's, and the two meet
at the same vocabulary — a specifier, a binding, a member site — so both answer
to the same core rather than to each other. Parsing is what lets it see the
`import "server-only"` forms a regex cannot.

**The baseline is a ratchet, not a suppression list.** `.architecture-baseline.json`
records violations a repository is carrying while it adopts a rule — the
alternative to carrying them is not turning the rule on. Two properties make it
a ratchet:

- Entries are **line-independent fingerprints** (`kind|rule|file|subject`), so an
  entry survives edits to the file it names. One keyed on a position would go
  stale on the first reformat and silently re-admit what it recorded.
- **A stale entry is an error.** Fix a violation and `lint:architecture` fails
  until its line is gone. Otherwise the floor never rises and the file stops
  describing anything real.

`explain` exists because a tree answers "what governs this file?" well and "which
files does this rule govern?" badly — the inverse of a flat config. It prints the
allowlist in force, every prohibition that reaches the file with the first
sentence of its reason, the folder rule that admits it, and the siblings it owes.

## The plugin arrives built

oxlint loads plugins with a bare `import()`, and `.oxlintrc.json` names the
package's own `oxlint-architecture-rules/plugin` export. The published tarball
carries the compiled JavaScript, so no lint command builds anything first and
there is no local `build/` to go stale — a stale one would enforce a stale policy
and still lint green, the same vacuity failure in a different disguise. The
pinned version is what makes that reproducible: bump it deliberately, then run
`pnpm lint:rules` and `pnpm lint:edges`, which is where a behaviour change in the
engine shows up.

## The one thing none of this can do

**Circularity** needs the whole dependency graph, which a per-file rule does not
have. oxlint's own `import/no-cycle` owns it, enabled in `.oxlintrc.json` and
probed like everything else.
