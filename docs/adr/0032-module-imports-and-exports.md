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

**A module provides the modules it reaches**, naming their `<feature>.module.ts` directly:

```ts
export const AuthModule = {
  layer: Layer.mergeAll(AuthCommandsLive, AuthQueriesLive).pipe(
    Layer.provide(RoleModule.layer),
    Layer.provide(UserModule.layer),
  ),
  http: AuthLive.pipe(
    Layer.provide(AuthIdentityRepositoryLive),
    Layer.provide(SessionRepositoryLive),
  ),
  httpDeps: OidcClient.layer,
};
```

The three fields stay apart because the composition root provides them at three depths of the
server pipeline — `layer` below the buses, `http` into `HttpApiBuilder.layer`, `httpDeps` into the
result of `HttpRouter.serve`. That last one is not a style choice: providing such a service onto its
own group layer leaves it in that layer's requirements, because `HttpApiBuilder` carries a handler's
requirement through to the assembled api and only `serve` unwraps it. Merging the three would
type-check and then fail to serve.

`Layer.provide` is a private import — role does not appear in auth's output type — and `Layer.provideMerge` is a re-export. That distinction is the imports/exports mechanism, and Effect already had it. There is nothing to invent and nothing to check: a module that forgets an import fails to compile, in its own file, one line from the adapter that needed it.

**There is therefore no order.** The composition root is a `Layer.mergeAll` over a set:

```ts
export const applicationModules = {
  layer: Layer.mergeAll(
    RoleModule.layer,
    UserModule.layer,
    AuthModule.layer,
    OrganizationModule.layer,
    BillingModule.layer,
    TodosModule.layer,
    WalletModule.layer,
  ),
  http: Layer.mergeAll(AuthModule.http, UserModule.http /* … */),
  httpDeps: AuthModule.httpDeps,
};
```

Reordering those lines cannot break anything. A module provided at several sites is built once — Effect memoizes a layer by reference across one build — which is what makes closing over a shared module safe rather than a way to end up with two event buses.

**Coupling and wiring are separate planes, and this is the part worth getting right.** A module needs another module's _Layer_ only because a DI container has to be told who provides what — that is a fact about how this application is assembled, and it would be a different fact if we assembled it differently or not at all. A module needs another module's _message contract_ because its ACL adapter genuinely asks that bounded context a question. Only the second is coupling. Putting both on one file would file incidental complexity next to the real thing and make the published surface stop meaning anything.

That is about what a module **publishes**. What it **consumes** funnels the other way: a module names another module in exactly one file.

So they sit on different planes, each with its own inbound rule:

- `<feature>.exports.ts` — the PEER surface. `Query.subsetOf(roleQueryGroup, "FindUserRolesQuery")` and domain vocabulary a peer names. Reachable only from a consumer's `infrastructure/acl/**` or `interface/events/**`. No Layer.
- `<feature>.module.ts` — the WIRING plane. The module's Layers. Reachable only from another module's `<feature>.module.ts` and from its own `<feature>.platform.ts`.
- `<feature>.imports.ts` — the inbound GATEWAY, and the mirror of the peer surface. Every foreign name a module uses enters here, from either plane: the message subsets it dispatches and the Layers it provides to wire them. An ACL adapter, an event adapter and `<feature>.module.ts` read their own module's gateway; none may name another module directly.
- `<feature>.platform.ts` — the PLATFORM surface. Reachable only from `@/server.ts`, `@/platform/**`, `@/test-utils/**` and tests. There is no `index.ts` in a module root: every file there is a dot-delimited stereotype named for the plane it serves (ADR-0024).

`architecture/imports` refuses every other combination, and `lint:edges` pins both directions: a module file may name another module file, an ACL adapter or a policy may not.

There is a concrete payoff beyond tidiness. When the Layer lived on the peer surface, `role.exports.ts` re-exported from `role.module.ts`, so every ACL adapter that imported a message contract transitively pulled in that module's entire assembly — handlers, repositories, the database. Separating the planes cuts that: a contract import now reaches a contract.

`subsetOf` (added to `@effect-server-utils/cqrs` for this) builds a group of exactly the named messages. A dispatcher over it demands only those tags' registrations, so a peer reaching for a query missing from the list needs a registration this module never published — and adding a query to `roleQueryGroup` cannot widen the grant. goodbones governs who may open the file at all.

**A service whose adapter differs between composition roots stays a requirement.** Billing's `BillingGateway` is the only one — Stripe in production, a fake in the test runtime — and it used to be expressed by shipping two whole module values and parameterizing the composition root on which one to take. That is backwards: `applicationModules` is the file both roots share _verbatim_, so it should not be the file parameterized by the thing that differs between them. The gateway now sits in the module layer's requirement channel, the module publishes both adapters from `billing.platform.ts`, and each root provides the one it wants beside the database, auth middleware and HTTP transport it already chooses. `applicationModules` takes no parameters and every module is listed the same way.

**A module's policy contribution lives in its own layer.** Otherwise the cross-module edges its policy checks reach through are satisfied at the composition root and appear in no module's requirement channel. A **registry** of those contributions is a different species again: nobody owns it, every module contributes one entry, and the platform folds them — the same shape as the command and query buses. `PolicyRegistryLive` and `ResourceResolverRegistryLive` therefore live beside `applicationModules` rather than inside any module, and ride its `httpDeps` because they are resolved per request like any other. Neither composition root names them: both would name them identically, and anything both roots agree on belongs in the assembly they share.

## Why not the Builder

We built it, migrated both roots onto it, and then measured it against plain layers on a branch. The findings:

- **Effect already catches a misordered graph.** An unsatisfied requirement bubbles to the composition root either way. The Builder's advantage was error _quality_: its first four errors sat at the composition root and read `MissingDependencies<"auth", RegisteredTag<"FindUserRolesQuery">>`, where Effect's first error sits at `server.ts` and names the tag but not the module that wanted it. Total error count was 48 with the Builder against 36 without — both noisy, neither decisively better.
- **That advantage is on a mistake the new design cannot make.** There is no ordering to misorder. The remaining mistake is a forgotten `Layer.provide`, in the file where you just wrote the adapter that needs it.
- **`subsetOf` deflated the rest.** Once per-message narrowing lives at the producer and goodbones governs the import edge, the Builder's `Exports`/`Visible` accumulation is checking something two other mechanisms already check.
- **A real cycle is now an ES module cycle**, reported by name by `import/no-cycle` and goodbones' `no-cycles`. The Builder only made a cycle unwriteable as a linear order, which is weaker and less legible.
- **`Module.make` was a record of three layers.** An object literal says the same thing with no package behind it, and that is what a module file exports now.

What the Builder did that nothing replaces: `UnusedExports` — refusing an export no module consumes, at message granularity. `no-orphans` and the conformance slack report cover the file and allowance granularities; the message granularity is genuinely lost, and is the price.

## Consequences

- The module graph moves out of the composition root and into the modules, next to the ACL adapters that create the edges. Reading `auth.module.ts` now tells you what auth depends on.
- Neither composition root states an order, so the two cannot disagree about one, and neither parameterizes the shared assembly on what differs between them.
- The `@org/module` package is deleted.
- `platform/modules/application-modules.ts` no longer displays the whole graph in one place. `pnpm architecture:facts` and the goodbones graph rules are where you ask that question now.
