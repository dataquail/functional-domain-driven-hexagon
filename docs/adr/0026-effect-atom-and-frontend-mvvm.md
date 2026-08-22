# ADR-0026: Effect Atom as the frontend state substrate, and MVVM as the layering

- Status: Accepted
- Date: 2026-08-21
- Supersedes: ADR-0014

## Context and Problem Statement

ADR-0014 tiered the view layer into three forms — naked component, presenter,
ViewModel — and graduated code between them. The graduation rule existed for one
reason: TanStack Query and TanStack Form are intrinsically React-coupled. They
publish hooks, not values, so any orchestration that touched them had to live
somewhere a renderer could run. That somewhere was the presenter, and the
presenter was the tier that could not be tested without React.

The cost showed up in three places.

**Testing.** Every presenter test needed a renderer, a `QueryClientProvider`, a
substitute runtime and a fake `Toast` service. `renderHook` was doing the work
that a plain function call should have done, and the assertions were about hook
return values rather than about behaviour.

**Two cache models.** Data lived in the TanStack cache; everything else lived in
React state or in an Effect `Ref` behind a presenter. Invalidation was a
hand-maintained query-key vocabulary in `services/data-access/`, and a mutation
and a query disagreeing about a key's spelling produced a stale screen with no
error anywhere.

**Hydration lied about types.** TanStack's `dehydrate → JSON → hydrate` does not
re-run the schema decode, so a `Schema.DateTimeUtc` field arrived on the client
as an ISO string despite its contract type. Three view-models carried the same
defensive `formatDate(value: unknown)` shim to cope, each with a comment
explaining the lie.

Meanwhile `effect` itself ships a reactive graph: `effect/unstable/reactivity`
(`Atom`, `AtomRegistry`, `AtomHttpApi`, `AsyncResult`, `Reactivity`,
`Hydration`). It is not React-coupled — a `React` binding exists as a separate
package, and the graph itself runs under a bare registry.

## Decision

**Effect Atom is the frontend state substrate, and the frontend is layered
Model → ViewModel → View with the dependency arrow enforced in that direction
only.**

### The Model — `packages/web/services/`

`services/data-access/<feature>.atoms.ts` binds the `@org/contracts` `DomainApi`
to atoms through `AtomHttpApi.Service`:

- `ApiAtoms.query(group, endpoint, request)` → `Atom<AsyncResult<A, E>>`,
  memoised on the request.
- `ApiAtoms.mutation(group, endpoint)` → an `AtomResultFn`.

Invalidation is `reactivityKeys`: a mutation names the keys it dirties, a query
names the keys it depends on, and the `Reactivity` service refreshes the
intersection. Both sides declare against one table
(`services/atom/reactivity-keys.ts`) so a typo is a missing property rather than
a silently stale screen.

`serializationKey` opts a query atom into `Hydration`, which is what the RSC
prefetch encodes into. Hydration decodes through the endpoint's own schema, so a
`Schema.DateTimeUtc` field is a real `DateTime.Utc` on the client — the three
`formatDate(value: unknown)` shims are deleted, and `services/format/date.shared.ts`
is a typed one-liner in their place.

Two seams that used to be injected services are now state, because a ViewModel
that writes to an atom needs no service in its requirement channel and a test
needs no stub:

- `services/atom/notifications.shared.ts` — the latest notification. One
  subscriber at the edge of the app turns it into a sonner call.
- `services/atom/navigation.shared.ts` — the current pathname inbound, a
  navigation request outbound. One bridge component owns the Next router.

Both atoms are `Atom.keepAlive`: the bridge is their only subscriber, and a
value the registry released between the write and the bridge's read is a toast
that never appears or a navigation that silently did not happen.

### The ViewModel — `features/**/*.view-model.ts`

All of a feature's behaviour: page state, derived views, field state, validation,
submit orchestration, the notification policy, and which reactivity keys a write
dirties. It is atoms and Effects and nothing else — no React, no JSX, no
`@effect/atom-react`. A ViewModel test builds an `AtomRegistry`, sets atoms, and
reads them back. There is no renderer anywhere in the file.

### The View — `features/**/*.view.tsx`

Naked React. It may call the atom-React bindings (`useAtomValue`, `useAtomSet`,
`useAtomSuspense`, …) and nothing else — no `useState`, no `useEffect`, no
`useReducer`. Anything that looks like it needs one is state, and state lives in
the ViewModel.

Two consequences fall out of that rule, and both are load-bearing:

- A prop that would have been copied into state with an effect becomes a
  **family key** instead. The device-approval page's `?code=` is the clearest
  case: `fieldsAtom("ABCD-2345")` starts pre-filled and `fieldsAtom("")` starts
  empty, with no synchronisation to get wrong.
- A View is tested by injecting the ViewModel's output: `renderView` takes the
  atom values to seed, which states the left-hand side, and reading the registry
  back after an interaction checks the right-hand side. No server, no fetch, and
  no ViewModel derivation in between.

**There is no presenter tier.** It existed to hold a React-coupled library, and
there is no longer one to hold.

### Forms

TanStack Form is replaced by fields-as-atoms plus a derived errors atom, backed
by the contract schema through Standard Schema v1
(`services/atom/form-validation.ts`). All six forms in the app validate on
submit, so per-field `touched`/`dirty`/blur state is deliberately not
reproduced; if a form ever needs it, it is more state in the ViewModel.

### The dependency arrow

| From                          | May depend on                                          | May not         |
| ----------------------------- | ------------------------------------------------------ | --------------- |
| `app/**` (framework surface)  | Model, features                                        | —               |
| `features/**/*.view.tsx`      | its own ViewModel, `@org/components`, `@org/contracts` | `services/**`   |
| `features/**/*.view-model.ts` | `services/**`                                          | any View, React |
| `services/**`                 | contracts, `effect`                                    | `features/**`   |

Enforced by `.dependency-cruiser.cjs`: `web-view-reaches-only-its-view-model`,
`web-view-model-no-view`, `web-view-model-no-react`, `web-model-no-features`,
`web-view-no-effect-runtime`, `web-no-tanstack`. The stereotype set is enforced
by `project-structure/web-features` (deny-by-default: a feature file is a View, a
ViewModel, or a test), and the hook allowlist by `local/view-hooks-allowlist`.
Each of those fires against a planted violation in `pnpm lint:rules` (ADR-0025).

## The memo-map hazard

`Atom.defaultMemoMap` is module-global and keyed by layer identity in a `Map`
that never evicts. Building a per-request server layer — one carrying that
request's cookie — inside an RSC render would therefore add a permanent entry
per request. This is the single most important thing to know about running Atom
server-side, and it is not obvious from the API.

The server-side design avoids it entirely: **no atom runtime is ever built on the
server.** `services/atom/prefetch.server.ts` runs the query's plain Effect on the
per-request `HttpApiClient` runtime, then reads the atom's own serialization
metadata to encode the result (`dehydrateQuery`). Reading metadata is pure; the
atom is never mounted. What crosses the RSC boundary is already plain JSON
encoded through the endpoint's schema, so the `Schema.Class` instances Next
refuses to serialize never reach it.

A failed prefetch yields no entry rather than throwing: the page still renders
and the client atom fetches for itself. That is also how "this org has no
subscription yet" works — the 404 produces no hydration entry, and the client
folds it back into `null`.

## Consequences

- Four TanStack packages leave (`react-query`, `react-query-devtools`,
  `react-form`, and the `query-core` transitive); `@effect/atom-react` arrives,
  pinned to the same beta as `effect`. Atom core itself is already in `effect`.
- `lib/tanstack-query/**` (10 files of hand-rolled Effect↔TanStack bridge),
  `lib/query-client.*`, the `Toast` service, the client `ManagedRuntime`, and
  the presenter harness are all deleted.
- Browser tracing moves to `Atom.runtime.addGlobalLayer(BrowserTracerLive)`, so
  every query, mutation and ViewModel action still emits OTLP spans without
  naming the tracer.
- `effect/unstable/reactivity` is unstable. `effect` is pinned exact and
  `@effect/atom-react` must be pinned to the identical version; a beta bump is a
  deliberate, tested change.
- The Model-tier tests are partly _our_ coverage of `AtomHttpApi`, which has one
  upstream test.

## Alternatives considered

**Keep TanStack, add Atom for non-server state.** Two cache models and two
invalidation stories, which is the problem this ADR set out to remove.

**Keep the presenter tier as a hook-holder.** With TanStack gone the only thing
left to hold is `useState`, and that is exactly the state MVVM wants in the
ViewModel.

**Framework-agnostic ViewModels over TanStack's `QueryObserver`.** ADR-0014's
Observable shape. It worked, but it was a hand-written adapter over a
React-first library; `AtomHttpApi` is that adapter, maintained upstream and
bound to the contract.

## Related

- ADR-0014 — the three-tier layering this supersedes.
- ADR-0015 — the component library the View tier renders through.
- ADR-0018 — the Next renderer and `/api` proxy; its prefetch section is amended
  to the Atom hydration flow.
- ADR-0019 — the integration-test seam, now mounting a registry rather than a
  `QueryClientProvider`.
- ADR-0025 — the lint substrate the new rules and their probes run on.
