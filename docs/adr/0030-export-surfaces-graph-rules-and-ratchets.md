# ADR-0030: export surfaces, graph rules and adoption ratchets

- Status: Accepted
- Date: 2026-09-02

## Context and Problem Statement

ADR-0028 wrote the architecture as one manifest and ADR-0029 made the engine a
dependency, pinned to `oxlint-architecture-rules@0.1.0-beta.0`. The second beta
adds three things the policy had no way to say, and changes one thing it was
already saying without knowing it.

**Three families of question had no rule.** The manifest could say what a file
may import and which names it may declare, but not what it may _export_ — so a
default export where nothing needs one, a `export *` that republishes a fenced
name through a barrel, or a helper declared in a module's `index.ts` were all
policed by a hand-rolled oxlint rule with five overrides, or by nobody. Nothing
could say anything about the shape of the whole import graph: a file nothing
imports, two files that import each other, or a tier that reaches another
_through_ a third. And nothing measured the policy itself — how much of the tree
its rules actually reach, or how many tiers still say "not tightened yet".

**One rule was reading less than it claimed.** The two repository-vocabulary
rules read the members of a bare `type X = { … }`. A port written as an
intersection — `Base & { … }` — was invisible to them, and their generated probe,
which never meets a parser, passed anyway. Beta.1's extractor reads interfaces
and aliases through intersections, unions and parentheses, and lets a rule carry
an _authored_ probe so that claim is checked at load.

The second beta is not a drop-in: the plugin now sees `import()` and `require()`
as edges, every whole-module form (`export *`, `import * as`, `import()`,
`require()`) is one `namespace` binding, and a `members` rule on a folder now
covers its subtree. The bump was made first, alone, and produced no new
diagnostics; everything below was written afterwards, against what
`architecture facts` reads from real files.

## Decision

### `surface`: what a file may export, stated in the manifest

A node carries `surface`, an array of entries that select export sites and make
one demand each. The repo states six things with it, all under one rule id,
`architecture/surface`, enabled in `.oxlintrc.json` beside the other four:

- **No default exports**, at every root. A default has no canonical name, so
  every importer invents one and the symbol becomes ungreppable. The exemptions
  are the frameworks that demand a default — Next routes and config, migrations,
  stories and the Storybook config, vitest configs and `globalSetup` — each listed
  as `except` beside the rule at the root it applies to. `local/prefer-named-exports`
  and its five `.oxlintrc.json` overrides are deleted: a policy with its
  exemptions in one place beats the same policy with the exemptions scattered
  through a linter config, and two rules reporting one site is noise. The
  "28 default-export primitives" the migration plan expected to convert were all
  stories.
- **No `export *`** in the server and web. Two named exemptions: the DDD contracts
  tier re-exports one domain-safe library module wholesale, with its reasons in
  the file, and the web test-fixtures barrel exists to gather fixtures. The
  contracts, database and component barrels are deliberate and the rule is not
  stated over them.
- **A module barrel re-exports and declares nothing.**
- **A handler file exports exactly one `*Handler`**, and every value it exports is
  camelCase. The count is over `*Handler` rather than over every value because
  `mint-api-token.handler.ts` also exports a transaction-free core that the
  device-grant poll runs inside its own unit of work. That is a use case
  publishing a sub-step, not a second use case; the rule says so rather than
  forcing a refactor to satisfy a count.
- **A port exports types and its Tag class, never a value.** Every port in the
  repo is a `type XShape` beside a `class X extends Context.Service`; a `const`
  or a function there is an implementation, and implementations live behind the
  port.
- **A test exports nothing** — the other half of the repo-wide "nothing imports a
  test" prohibition.

### `graph`: cycles, orphans and reach, in the CLI only

The top-level `graph` section states rules only a whole-repository walk can
evaluate. `architecture check` builds the graph once and runs them; the oxlint
plugin, which sees one file at a time, compiles and probes them — so a vacuous
one still fails `pnpm lint` — but never runs them. **A violated graph rule fails
`pnpm lint:architecture` alone.** That asymmetry is accepted and written down:
the CLI is a superset of the linter, not a mirror, and it is a gate in
`check:all` for that reason.

- `no-cycles` over every package. oxlint's `import/no-cycle` stays enabled: it is
  per-file at editor speed, while this one has a scope, reports each strongly
  connected component once with a set-stable subject, and lands in the baseline.
- `no-orphans` over every package. Its `entry` list was derived from findings, not
  guessed: the first run reported 42 files, and each was read. Test files, specs,
  stories, setup files and vitest configs are loaded by a runner; `server.ts`,
  the three `main.ts` files and the database scripts are process entrypoints;
  Next's `app/**`, `instrumentation.ts` and `next.config.ts` and the Storybook
  config are framework-loaded. Fakes are `withinNot`: the taxonomy owes a fake to
  its port whether or not a test takes it, so an unused one is a policy decision
  rather than dead code (see Consequences). **Three files were dead and are
  deleted**: `platform/request-context.ts` (imported by nothing; only comments
  mentioned it), `components/primitives/index.ts` (a barrel the package's
  `exports` map could not even reach), and `acceptance/drivers/pages/users-page.ts`
  (superseded by the `@org/test-drivers` adapter the specs actually import).
- Five `reach` rules. Four state transitive versions of boundaries the per-edge
  allowlists already imply — the domain and the use cases reach no adapter, web
  never reaches the server, contracts reach nothing — and exist so that a
  loosening of any intermediate tier's allowlist is caught at the far end.
  `platform-reaches-modules-only-through-barrels` is the one written with `via`:
  a route from the kernel into a module is fine as long as it steps onto the
  module's `index.ts`, and only a route that avoids every barrel is the
  violation. Each fires on a synthetic route in `lint:edges`.

### `limits`: the policy measures itself

```js
limits: {
  unrestricted: 1, partial: 0,
  coverage: { imports: 0.96, structure: 0.73, members: 0.03, surface: 0.91, graph: 1 },
},
```

The ceilings cap the tiers that say "not tightened yet" — one, `server.ts`, whose
allowlist could only be "the whole repo". The floors are the fraction of walked
files each family reaches, set to what `architecture coverage packages` reported
on the day they were written, rounded down. They are a ratchet in the same sense
the coverage thresholds in `vitest.config.ts` are: raise a floor when coverage
rises, never lower one to make a red run green. `members` is honestly 3% — the
vocabulary rules select repository ports and Views, and nothing else has a
vocabulary to police yet.

### Authored probes where a generated one proves nothing

`members` and `exports` rules about a declaration shape now carry
`probe: { source, … }`, a snippet parsed at load out of which the rule must
report the named site. The two repository-vocabulary rules are probed with an
intersection, `ZzBase & { readonly findOneByEmail … }` — the shape the old
extractor could not see. No port in the repo is currently an intersection (the
plan's count was stale), which is exactly why the probe is worth having: the rule
is proven against the shape it would otherwise silently miss.

### Every binding form, and a second fence on the bus factories

`bus-factories-at-composition-roots` names six factories and, by default, speaks
only to named bindings. It deliberately does not cover `default`: neither library
publishes one, so `import makeCommandBus from` is a type error before it is a
policy question. It cannot cover `namespace` — a namespace binding's only name is
`*`, so a rule listing `symbols` alongside that kind is refused at load — and the
namespace form is the real way around a symbols list. A second restriction,
`no-whole-server-utils-imports`, refuses `import * as`, `export *`, `import()` and
`require()` of either library outside the same composition roots, with the DDD
contracts tier's wholesale event re-export as its one named exemption.

## Consequences

**Everything is verified by planting.** Every new rule was planted as a violation
and seen to fire under `pnpm lint` and `pnpm lint:architecture` (per-file
families) or `lint:architecture` alone (graph), including a negative case — a
platform file reaching a module Layer through its barrel stays quiet. The probe
script gained three `architecture/surface` probes and one namespace-binding
`architecture/exports` probe (33 rule ids now); the edges script gained twelve
graph shapes beside its 166 edges. `check:all` is green with no
`.architecture-baseline.json`.

**Five ACL fakes are owed but unused.** `no-orphans` found that the
`platform-roles` and `organization-access` fakes in `auth`, `billing` and `todos`
are imported by nothing: the policy checks that consume those ports take their
data source as an argument, so their tests pass a function rather than the fake
Layer. The parity rule requires the fakes to exist. Scoping fakes out of the
orphan rule keeps both statements true, but the tension is real and is a
decision for the team: point the policy tests at the fakes, or relax the ACL
parity obligation to the live and its test. Neither was done here.

**The CLI is a gate, not a mirror.** Before this the two adapters answered the
same question two ways; now `lint:architecture` also answers questions the plugin
cannot. Dropping it from CI would silently drop cycles, orphans, reach and the
coverage floors.

**The oxlint config shrank by six entries** — one rule and five overrides — and
the policy they expressed moved into the manifest, beside the rules that state
the exemptions' reasons.

## Alternatives considered

**Amend ADR-0028 instead of writing this.** ADR-0028 records the manifest's shape
and the decisions inside it; this records the decision to enforce transitive
reach and cycles in the CLI only, to state ceilings and floors in the policy, and
what the first orphan run found. Those are architectural and deserve their own
record; ADR-0028's follow-ups pointed here.

**Drop `import/no-cycle` now that `no-cycles` exists.** Rejected for the moment:
the oxlint rule gives editor-speed feedback and costs nothing measurable. Drop it
only if it proves slow.

**Keep `local/prefer-named-exports` beside the surface rule.** Rejected: two
diagnostics per site, and the exemption lists would drift apart.

**Ban `export *` everywhere with the deliberate barrels excepted.** Rejected: the
contracts `export * as` map, the row-schema barrel and the primitives barrel are
the point of those files, and a rule whose exemptions are its only matches is a
rule with nothing to say.

**Fence `import * as` of module internals repo-wide.** Rejected: the 175
`import * as Sibling from "./sibling.js"` namespace imports are this repo's house
style, and the per-edge barrel rules already refuse the cross-module case.

## Follow-ups

- Decide the ACL-fake tension above.
- `members` coverage is 3%. The next vocabulary worth stating is the endpoint
  adapters' — which `HttpApiBuilder` and `Effect` calls an endpoint may make.
- Raise the `structure` floor by enumerating the open folders in `services/` and
  `lib/` once their file kinds settle.

## References

- ADR-0028 (the manifest), ADR-0029 (the engine as a dependency)
- `docs/scratch/oxlint-architecture-rules-beta-1-migration-plan.md` — the plan this implements
- `oxlint-architecture-rules` — `manifest/surface`, `manifest/graph`, `enforcement/probes`, `enforcement/adoption`, `enforcement/cli`
