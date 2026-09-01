# ADR-0028: the architecture manifest

- Status: Accepted
- Date: 2026-08-31

## Context and Problem Statement

ADR-0027 consolidated three enforcement engines into one oxlint plugin driven by
configuration. It worked — one command, one config, 40 import rules ported with
a diffable oracle — but the configuration it produced was four flat arrays keyed
by rule family. Everything the architecture said about one file was scattered:
to know what governed `modules/<m>/domain/<sub>/*.repository.ts` you read a
`structure.folders` entry, a `structure.parity` entry, three `imports` rules and
a `members` rule, and nothing in the file said they were related.

Two further problems came from the shape rather than the scattering.

**Denylists go vacuous quietly.** A `toNot` that widens by one pattern silently
stops firing. That is the exact failure the probe machinery exists to catch, and
it is a property of writing rules as prohibitions over an open world.

**`$1` is not a name.** Backreferences inherited from dependency-cruiser meant
"my own module" was a positional trick that only worked on one side of a rule.

## Decision

Write the policy as a **manifest**: one tree of the repository where every node
states what that part of the tree may import, who may import it, which names it
may declare, and which siblings its files owe.

```js
"@/modules/{module}/domain/{subdomain}/": {
  imports: { reset: true, external: ["effect"], allow: ["@/modules/{module}/domain/{subdomain}/**", …] },
  children: {
    "*.repository.ts": {
      requires: ["../../infrastructure/repositories/{base}-live.ts", …],
      importedBy: { allow: ["@/modules/*/commands/**", …] },
      members: [{ subject: "type-members", in: "*Repository*", allow: [
        "findOne", "findMany", "insertOne", …] }],
    },
  },
},
```

**The manifest is the authoring surface; the flat rules stay as the IR.** It
compiles down to the same `imports` / `exports` / `members` / `structure` rules
the engine already ran, so the evaluators, resolution, filesystem access and
probe machinery are unchanged and the migration was verifiable rule by rule.

### Allowlists, not denylists

An allowlist cannot widen silently: permitting something means naming it, at the
node that permits it. Eight denylist rules collapse into one allowlist on the
`domain/` node, and the rule that stopped it going vacuous is now the shape of
the config rather than a probe bolted on afterwards.

### Named captures, and a compile error where they cannot work

`{module}` and `{subdomain}` replace `$1`. The node already sits at that level,
so "my own module" stops being positional. Where a capture genuinely cannot
resolve — `importedBy.allow` is matched against the _importer_, but the capture
was declared by the _target's_ path — the compiler **refuses to compile** rather
than emit an exemption that never matches. Silence there would make the rule
over-report, which is the mirror image of vacuity and just as hard to spot.

### One merge rule, and prohibitions outside it

Allowances inherit until a node `reset`s. Prohibitions are emitted once over the
subtree that declares them and always accumulate, so **no node can make a
subtree quieter than its ancestors** — the direction a mistake here would be
dangerous in. An exemption to a prohibition is declared by the prohibition
(`except`, `matchNot`), never by the tier escaping it.

### Probes are generated

A node's own path _is_ its probe. 217 rules, zero hand-written probes, and the
plugin refuses to load if any rule fails its own.

## Consequences

**Everything is covered.** 843 files across every package — the server modules,
the platform kernel, `common/`, web, components, and the six leaf packages. The
dependency direction between packages (`contracts ← api-client ← cli`,
`database ← jobs`, and nothing reaching the server) is enforced for the first
time.

**Two rules were only half-applied.** `not-to-spec` and the SQL-driver fence are
statements about the whole repo, so they became a manifest-level `deny`. Before
that, web, components and the platform kernel were quietly outside them. The
TanStack ban was a third, and turned out not to need one: no tier's `external`
list names the package, so every allowlist already refuses it. A denylist rule
that an allowlist has made unreachable is exactly the debt this shape was
supposed to retire, so it went.

**Deliberate tightening, measured.** 49 edges that the previous config permitted
are now refused — the tiers that carried no allowlist at all (`infrastructure/`,
`interface/http|cli`, the module root, `common/`, every leaf package). Each is a
row in `pnpm lint:edges` asserting the old config allowed it and the manifest
does not, so a list that quietly admitted everything fails rather than passes.

**Two gates, not one.** `lint:rules` proves the wiring; `lint:edges` proves the
semantics — 166 edges, 124 refused and 42 allowed. The allowed rows carry equal
weight: a policy that refuses everything is as broken as one that refuses
nothing.

**What the port found.** A `external: ["\`effect\`"]`with backticks inside the
string, inert for four rounds because the node above it was marked partial. A
Lives prohibition hoisted one level too far.`policies/`losing its ACL access to
a shared constant.`"http/ | cli/"`stripping one trailing slash instead of two.
An`import "server-only"` side-effect import that a regex survey cannot see but
an AST can. None of these were caught by reading; all were caught by running the
policy against the real tree or against a planted violation.

### Naming, because a taxonomy is only half a convention

`children` enumerates the stereotypes a folder admits and says nothing about the
concept name in front of one. `*.handler.ts` is satisfied by
`create-todo.handler.ts`, `CreateTodo.handler.ts` and `create_TODO.handler.ts`
alike, and a whole module folder called `Todos_V2` passed every rule we had. That
is a real degree of freedom, and the one a contributor — or an agent working from
the manifest — drifts through first, because nothing pushes back.

A node therefore carries a `name`: one of four conventions, a regex with a
sentence saying why, or `{ like: "{capture}" }`. It **inherits like `imports`**,
so a tier states it once rather than on each of a hundred stereotype keys.

Two decisions inside that are worth recording.

**A file's concept name is its basename up to the first dot, not what a `*`
matched.** The key `*-live.ts` matches `todos.repository-live.ts`, where the
wildcard spans a stereotype segment as well as the concept; judging the wildcard
would report every compound stereotype in the repo. ADR-0024 already makes the
dot the delimiter, so the rule reads it the same way.

**A custom regex still owes a counter-example.** The compiler tries a handful of
candidate names and takes the first the pattern refuses; if the pattern admits
all of them, the manifest fails to compile. A convention nothing can violate is a
rule that never reports, and this is the same guarantee the generated probes give
every other rule — held at the one place a human writes the pattern themselves.

The conventions this repo declares are the ones it already followed: kebab-case
for the server, web, components, jobs, CLI, MCP and API client (0 exceptions
across ~900 files); PascalCase for `contracts/src`, whose files are Effect-style
modules named for what they export; snake_case for the numbered migrations; and
two regexes each carrying one named exception, `Database.ts` and
`features/__root/`. Nothing needed a baseline entry. `domain/{subdomain}/*.root.ts`
gets `{ like: "{subdomain}" }` — a subdomain folder is the aggregate, so `todo/`
holds `todo.root.ts`, and all twelve already did.

### One policy, several files, one evaluation

The manifest passed 1500 lines, lopsidedly — the server's modules alone were 632.
It is a JavaScript module, so each area now writes its own nodes beside its own
code and `architecture.config.mjs` composes them. No library change was needed.

**The split is of the authoring, not of the evaluation, and that distinction is
the whole decision.** A rule fires when the checker visits the _importing_ file,
so running one check per package would silently disarm every rule whose importer
lives on the other side of the split: the four repo-wide prohibitions, which have
to reach every file, and all six `importedBy` blocks. Measured before choosing:
a violation planted in `packages/components` reports under `check packages` and
vanishes under `check packages/web`. A disarmed rule is indistinguishable from a
passing one.

Keys stay repo-relative wherever they are written. Rerooting `packages/web`'s
nodes to a `web/` base would need a per-file base in the compiler, and would make
a pattern's meaning depend on which file it sits in — the opposite of a language
whose patterns are absolute and resolved.

The per-area files live inside the packages they describe, which makes them
subject to the policy they state. They are `.mjs`, so the CLI never walks them,
and they are ignored by oxlint for the same reason the docs site is.

### The server gets a single root

`packages/server/src` was four sibling top-level keys, so three taxonomy roots,
no shared parent for inherited policy — the naming convention had to be written
three times — and `test-utils/` governed by nothing at all (`explain` said "a
folder no rule governs"). It is now one `~/server/src/` node with `server.ts`,
`common/`, `platform/`, `modules/{module}/` and a new `test-utils/` as children:
one taxonomy root, one naming declaration, and a stray `src/helpers/` is a
violation rather than a gap.

## Alternatives considered

- **Keep the flat config.** Rejected once the second subtree was ported: the
  scattering is not a presentation problem, it is why three repo-wide rules had
  been applied to one region only.
- **Interpret the tree directly instead of lowering it.** Rejected: the flat
  rules were written and tested, an allowlist already lowers onto them
  naturally, and keeping them made the migration diffable at every step.

## The CLI and the baseline

The package ships a second adapter: `architecture check | baseline | explain`,
run here as `pnpm lint:architecture`. oxlint's JS plugin API is alpha, and a
policy only one alpha host can evaluate has a single point of failure.

It covers all four families. Where the plugin reads oxlint's syntax tree, the
CLI reads TypeScript's, and the two meet at one vocabulary — a specifier, a
binding, a member site — so both adapters answer to the same core rather than to
each other. That vocabulary is where the divergence risk lives, so each
extraction is tested against the forms that matter: side-effect imports,
`export … from` renames, `import =`, dynamic `import()`, `require()`, string
literal import names, method versus property signatures, computed keys, and
calls inside JSX. One parse per file; 919 files in under a second.

The baseline is what lets a repository turn a rule on before its code is clean;
the alternative is not turning it on. It is a ratchet rather than a suppression
list because of two choices:

- Entries are line-independent fingerprints (`kind|rule|file|subject`), so an
  entry survives edits to the file it names. One keyed on a position would go
  stale on the first reformat and silently re-admit what it recorded.
- A **stale entry is an error**. Fixing a violation fails the check until its
  line is deleted. A baseline allowed to keep entries the code no longer
  produces stops being a record of debt and becomes a place to hide.

`explain` answers the one question a tree config makes harder than a flat one.
"What governs this file?" a tree answers well; "which files does this rule
govern?" it answers badly, and grep no longer helps. It prints the allowlist in
force, every prohibition reaching the file with the first sentence of its
reason, the folder rule that admits it, and the siblings it owes.

### Rejected: a glob quantifier instead of a field

`[a-z0-9-]+.root.ts` as a child key would need only a `+` token in the glob
compiler, about ten lines. It was rejected because it puts the convention into
each of a hundred keys, where copies drift; it cannot constrain a folder capture,
which is where the worst case was (`modules/Todos_V2/`); and it cannot express
"named after its folder" at all.

## Follow-ups

Extract `@org/oxlint-architecture-rules` to its own repository and depend on a
pinned beta; `architecture.config.mjs` stays, because it is this repo's policy
rather than the library's.

## References

- ADR-0027 — architecture rules as configuration; this ADR changes the shape of
  that configuration, not the engine under it.
- ADR-0008, ADR-0025.
