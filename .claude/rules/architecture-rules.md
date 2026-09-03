# Rule: architecture rules (the manifest)

**Scope:** the whole repo — read before adding, changing, or removing an architectural check.
**Backing ADRs:** 0008 (architecture enforcement), 0025 (oxlint as the linter), 0027 (architecture rules as configuration), 0028 (the manifest), 0029 (the engine as a dependency), 0030 (surfaces, graph rules and ratchets).

Architectural enforcement runs inside `pnpm lint`, from one file — plus the
rules only a whole-repository walk can answer, which `pnpm lint:architecture`
evaluates.

| Where                                               | What it owns                                                                           |
| --------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `architecture.config.mjs`                           | resolve, aliases, the repo-wide `deny`/`exports`, `graph`, `limits`, the composed tree |
| `packages/architecture.mjs`                         | the six leaf packages, and the surface and test nodes every area shares                |
| `packages/{server,web,components}/architecture.mjs` | that package's own nodes, beside its own code                                          |
| `oxlint-architecture-rules` (npm)                   | the engine: resolution, lowering, matching, the graph, the anti-vacuity guard          |
| `scripts/lint-rule-probes.mjs`                      | `pnpm lint:rules` — each rule id still fires on a planted violation                    |
| `scripts/architecture-edges.mjs`                    | `pnpm lint:edges` — the policy still refuses and allows the edges and shapes it should |
| `scripts/lint-rules/`                               | the seven hand-rolled `local/*` AST rules that are not boundary rules                  |

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
      members: [{ subject: "type-members", in: "*Repository*", allow: […], probe: { source, name } }],
      surface: [{ message: "…", declares: ["function", "variable"] }],
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
| `surface`    | what may it export?                             |
| `requires`   | which siblings does this file owe?              |
| `children`   | which files and folders does this folder admit? |

Repo-wide statements sit at the top level: `deny` (prohibitions that hold
everywhere), `exports` (who may import a given exported symbol, and in which
binding form), `graph` (cycles, orphans and transitive reach — see below) and
`limits` (the policy's own ratchets).

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

## Surface: what a file may export

`surface` is an array on a node; on a folder it covers the subtree, like
`members`. Each entry **selects** export sites — `kinds` (`named`, `default`,
`namespace` for `export *` and `export * as`), `declares` (what the site was
declared as: `function`, `class`, `variable`, `type`, …), `reexport`, `match` —
and makes **exactly one demand** of them: `forbid` (the default when none is
written), `allow`, `convention`, or `count`. `except` lists files under the node
the entry does not apply to, so a framework's exemption is written beside the
rule that grants it rather than in a linter override somewhere else.

What this repo states with it, all under `architecture/surface`:

- **No default exports**, at every root, except where a framework demands one —
  Next routes and config, migrations, stories and the Storybook config, vitest
  configs and `globalSetup`. `noDefaultExports(except)` in
  `packages/architecture.mjs` is the one entry, applied per root with that
  root's exemptions. It replaced `local/prefer-named-exports` and its five
  overrides.
- **No `export *`** in the server and web. The DDD contracts tier's wholesale
  re-export and the web test-fixtures barrel are the two named exemptions; the
  contracts, database and components barrels are deliberate and outside the rule.
- **A module barrel re-exports and declares nothing.**
- **A handler file exports exactly one `*Handler`**, and every value it exports
  is camelCase. The count is over `*Handler`, not every value, so a handler may
  still publish a transaction-free core for a sibling that runs it inside its own
  unit of work — `mint-api-token.handler.ts` does.
- **A port exports types and its Tag class, never a value.**
- **A test exports nothing** — the other half of "nothing imports a test".

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
matches. A graph rule's globs carry no captures either — "a different module"
is not something they can say.

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

## Export restrictions see every binding form

An `exports` restriction speaks to the binding forms its `kinds` lists, default
`["named"]`. Every whole-module form — `import * as`, `export *`,
`export * as`, `import()`, `require()`, `import x = require()` — is the one
`namespace` binding, named `*`, so a rule listing `symbols` cannot also list
`namespace` (there is no name to match) and is refused at load. That is why the
bus factories are fenced by **two** restrictions: `bus-factories-at-composition-roots`
names the factories, and `no-whole-server-utils-imports` refuses the namespace
form that would carry them past it unnamed. Neither library publishes a default
export, so `default` is deliberately not in scope.

## Graph: the whole repository at once

A per-file rule cannot answer "does anything import this?" or "can this reach
that through three other files?". The top-level `graph` section can:

```js
graph: {
  cycles:  [{ name, message, within, withinNot? }],
  orphans: [{ name, message, within, withinNot?, entry }],
  reach:   [{ name, message, from, fromNot?, to, toNot?, via? }],
},
```

**Only `pnpm lint:architecture` evaluates them.** The plugin sees one file at a
time, so it compiles and probes the graph rules — a vacuous one still refuses to
load and fails `pnpm lint` — but never runs them. A violated graph rule fails
`lint:architecture` alone. That asymmetry is the reason the CLI is a gate in
`check:all` and not a mirror of the linter.

- `no-cycles` covers every package. It overlaps oxlint's `import/no-cycle`, which
  stays on: the oxlint rule is per-file at editor speed, this one has a scope,
  reports each strongly connected component once with a set-stable subject, and
  lands in the baseline.
- `no-orphans` says a file nothing imports is dead, unless it is an **entry**:
  something outside the graph loads it — a test runner by glob, a process by
  `bin`, a framework by convention. Every `entry` is a claim of that shape, listed
  with its reason. Fakes are `withinNot`: the taxonomy owes a fake to its port
  whether or not a test currently takes it. **Do not list a path as an entry to
  make a finding go away** — the first run of this rule found and deleted three
  dead files.
- `reach` states what a tier may reach transitively. `via` names the mediating
  tier: a route that steps onto a `via` file is fine, and only a route that avoids
  every one is the violation — `platform-reaches-modules-only-through-barrels`
  is the one written that way. The other four say the domain and the use cases
  reach no adapter, web never reaches the server, and contracts reach nothing.
  Each fires on a synthetic route in `lint:edges` as well.

## Limits: the policy's own ratchets

```js
limits: {
  unrestricted: 1, partial: 0,
  coverage: { imports: 0.96, structure: 0.73, members: 0.03, surface: 0.91, graph: 1 },
},
```

The ceilings cap the tiers that say "not tightened yet"; both adapters check them
at load. The floors are the fraction of walked files each family reaches, checked
by `lint:architecture`; set each to what `pnpm architecture:coverage` reports,
rounded **down** to two decimals. Raise a floor when coverage rises; never lower
one to make a red run green — the fix is a rule that reaches the files, or a file
moved under one. `structure` counts **enumerated** folders only; an open folder is
claimed, not policed, and does not count.

## Every rule proves itself

The manifest compiles to flat rules, each with a probe. Most are generated from
the node's own path: a rule whose globs match nothing, or whose demand nothing
could violate, fails to compile. **The plugin refuses to load if any rule fails
its own probe.**

A generated probe never meets a parser, so a rule about a **declaration shape**
can pass it and read nothing. `members`, `exports` and `surface` therefore accept
an **authored** probe — `probe: { source, name | symbol }` — a snippet parsed at
load, out of which the rule must report the named site. The two repository
vocabulary rules carry one each, written as an intersection
(`ZzBase & { readonly findOneByEmail … }`), because that is the shape the
extractor once could not see. When a rule is about what a declaration looks
like, write the probe in that shape.

Two gates back that up, and they answer different questions:

- `pnpm lint:rules` — the **wiring**: the plugin is loaded, each rule id is
  enabled, its globs match, resolution is live.
- `pnpm lint:edges` — the **semantics**: 166 edges with expected verdicts (124
  refused, 42 allowed) and 12 graph shapes with expected reports. The allowed and
  quiet rows matter as much: a policy that refuses everything is as broken as one
  that refuses nothing. A row that changes verdict is either a regression or a
  decision.

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

The package ships a second way to ask the same question, and the only way to ask
the graph ones:

```
pnpm lint:architecture              # every family, the graph rules, the coverage floors, the baseline ratchet
pnpm architecture:baseline          # record the violations this repo carries
pnpm architecture:explain <file>    # which rules of every family select this file, and why
pnpm architecture:facts <file>      # what the parser read: edges, bindings, members, calls, exports
pnpm architecture:coverage          # reach per family, and the adoption backlog
```

oxlint's JS plugin API is alpha, and a policy that only one alpha host can
evaluate has a single point of failure. The CLI is a **superset** of the plugin:
it reads TypeScript's syntax tree where the plugin reads oxlint's, the two meet at
the same vocabulary — a specifier, a binding, a member site, an export site — so
both answer to the same core rather than to each other, and it adds the graph.
Parsing is what lets it see the `import "server-only"` forms a regex cannot.

`explain` answers "what governs this file?", which a tree answers well and a flat
config badly. `facts` answers the other half — what those rules are evaluated
against — so a rule that "should fire" and does not is one of two mistakes you
can tell apart: the pattern does not select the site, or the site is not a fact
the extractor reads. Write a new `members` or `surface` rule against `facts`
output, not against what you remember a file exporting.

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

This repo carries none, and the file does not exist. Keep it that way: a finding
from a new rule is a fix or a decision written beside the rule, not a baseline
entry.

## The plugin arrives built

oxlint loads plugins with a bare `import()`, and `.oxlintrc.json` names the
package's own `oxlint-architecture-rules/plugin` export. The published tarball
carries the compiled JavaScript, so no lint command builds anything first and
there is no local `build/` to go stale — a stale one would enforce a stale policy
and still lint green, the same vacuity failure in a different disguise. The
pinned version is what makes that reproducible: bump it deliberately, then run
`pnpm lint:rules` and `pnpm lint:edges`, which is where a behaviour change in the
engine shows up. Every `architecture/*` rule id — `imports`, `exports`,
`members`, `structure`, `surface` — must be enabled in `.oxlintrc.json`; a family
left out runs in the CLI and not the editor, and the two adapters disagree.

## What the plugin still cannot do

**Anything about the whole graph.** Cycles, orphans and transitive reach need
every file resolved at once, which a per-file rule never has. They live in the
`graph` section and run in `lint:architecture`; oxlint's own `import/no-cycle`
stays enabled beside them for editor-speed feedback on the one of the three it
can approximate, and is probed like everything else.
