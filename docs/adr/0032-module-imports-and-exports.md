# ADR-0032: A module states its own imports and exports

- Status: Accepted
- Date: 2026-09-13

## Context and Problem Statement

ADR-0022 gives a consumer module an outbound port and a single anti-corruption adapter for every cross-module call. What it does not say is how the adapter's dependency is _satisfied_, or who is allowed to know that it exists.

Before this ADR, both answers were "the composition root". `server.ts` and `test-utils/test-server.ts` each folded the seven module layers together with `Layer.provideMerge` in a hand-computed order, and that order was the only thing making a cross-module edge resolvable: `auth` came after `role` because auth's `PlatformRoles` adapter dispatches a role query. Three problems followed.

- **The order was stated twice** and nothing checked the two roots agreed. A module added to one and not the other type-checks until the first dispatch.
- **The order was the only record of the module graph.** Reading `auth.module.ts` told you nothing about what auth depends on; you had to read the composition root and infer it from position.
- **A module's published surface was "everything it builds".** Every dispatch surface a module merged into the graph was resolvable by every other module. Measured across this repo: 13 dispatch Tags were visible to peers, 3 actually crossed a boundary; peers were granted 12 messages and used 4; 35 of 39 message definitions had no external importer at all.

We first addressed this with a checked composition root — a `Builder` in its own package, accumulating four type-level sets (visible, exported, consumed, assembled) so `.add(AuthModule)` failed with `MissingDependencies<"auth", RoleQueries>` when the order was wrong, and `build()` failed with `UnusedExports<Tag>` when a declared export had no consumer. It worked, and it is not what we shipped.

## Decision

**A module provides the modules it reaches.** `<Feature>Layer` closes over its imports:

```ts
export const AuthLayer = Layer.mergeAll(AuthCommandsLive, AuthQueriesLive).pipe(
  Layer.provide(RoleLayer),
  Layer.provide(UserLayer),
);
```

`Layer.provide` is a private import — role does not appear in auth's output type — and `Layer.provideMerge` is a re-export. That distinction is the imports/exports mechanism, and Effect already had it. There is nothing to invent and nothing to check: a module that forgets an import fails to compile, in its own file, one line from the adapter that needed it.

**There is therefore no order.** The composition root is a `Layer.mergeAll` over a set:

```ts
export const applicationModules = (billing: BillingLayer) => ({
  layer: Layer.mergeAll(
    RoleLayer,
    UserLayer,
    AuthLayer,
    OrganizationLayer,
    billing,
    TodosLayer,
    WalletLayer,
  ),
  http: Layer.mergeAll(AuthHttpLayer, UserHttpLayer /* … */),
  httpDeps: AuthHttpDepsLayer,
});
```

Reordering those lines cannot break anything. A module provided at several sites is built once — Effect memoizes a layer by reference across one build — which is what makes closing over a shared module safe rather than a way to end up with two event buses.

**A module publishes two surfaces, and the peer surface is per-message.** `index.ts` is the wiring surface, for the composition roots and the platform only. `<feature>.exports.ts` is the peer surface, reachable only from another module's `infrastructure/acl/**`, `interface/events/**` or `<feature>.module.ts`. It carries both halves of what a peer may reach:

```ts
export const rolePeerQueries = Query.subsetOf(roleQueryGroup, "FindUserRolesQuery");
export { RoleLayer } from "./role.module.js";
```

`subsetOf` (added to `@effect-server-utils/cqrs` for this) builds a group of exactly the named messages. A dispatcher over it demands only those tags' registrations, so a peer reaching for a query missing from the list needs a registration this module never published — and adding a query to `roleQueryGroup` cannot widen the grant. goodbones governs who may open the file at all.

**A module's policy contribution lives in its own layer.** Otherwise the cross-module edges its policy checks reach through are satisfied at the composition root and appear in no module's requirement channel.

## Why not the Builder

We built it, migrated both roots onto it, and then measured it against plain layers on a branch. The findings:

- **Effect already catches a misordered graph.** An unsatisfied requirement bubbles to the composition root either way. The Builder's advantage was error _quality_: its first four errors sat at the composition root and read `MissingDependencies<"auth", RegisteredTag<"FindUserRolesQuery">>`, where Effect's first error sits at `server.ts` and names the tag but not the module that wanted it. Total error count was 48 with the Builder against 36 without — both noisy, neither decisively better.
- **That advantage is on a mistake the new design cannot make.** There is no ordering to misorder. The remaining mistake is a forgotten `Layer.provide`, in the file where you just wrote the adapter that needs it.
- **`subsetOf` deflated the rest.** Once per-message narrowing lives at the producer and goodbones governs the import edge, the Builder's `Exports`/`Visible` accumulation is checking something two other mechanisms already check.
- **A real cycle is now an ES module cycle**, reported by name by `import/no-cycle` and goodbones' `no-cycles`. The Builder only made a cycle unwriteable as a linear order, which is weaker and less legible.
- **`Module` was a record of three layers.** Useful as documentation, not as enforcement.

What the Builder did that nothing replaces: `UnusedExports` — refusing an export no module consumes, at message granularity. `no-orphans` and the conformance slack report cover the file and allowance granularities; the message granularity is genuinely lost, and is the price.

## Consequences

- The module graph moves out of the composition root and into the modules, next to the ACL adapters that create the edges. Reading `auth.module.ts` now tells you what auth depends on.
- Neither composition root states an order, so the two cannot disagree about one.
- The `@org/module` package is deleted.
- `platform/modules/application-modules.ts` no longer displays the whole graph in one place. `pnpm architecture:facts` and the goodbones graph rules are where you ask that question now.
