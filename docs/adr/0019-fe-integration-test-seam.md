# ADR-0019: FE integration test seam is at the network boundary

- Status: Accepted
- Date: 2026-05-14

## Context and Problem Statement

The template has presenter tests for client-side logic (ADR-0014) and Playwright acceptance tests for cross-process flows (ADR-0009). Neither covers a third, valuable tier: **page-level integration tests** that render a real `(authed)/<route>/page.tsx` against a fake API, exercise the full presenter + data-access + cache + suspense + hydration stack, and assert on user-visible behavior. Presenter tests substitute the data-access layer; acceptance tests are too slow and too coarse to drive negative-path coverage at the page level. The integration tier sits between them.

The question this ADR settles: **what's the seam where the fake replaces the real API?**

The forces:

- The contract is an Effect `HttpApi` in `@org/contracts`. The production client is `HttpApiClient.make(Api)` over `FetchHttpClient`. Both server handlers and the FE client derive their request/response shapes and tagged error unions from this single source.
- The FE's `ApiClient` already accepts a swappable transport via Effect Layers — `Layer.succeed(FetchHttpClient.Fetch, ...)` overrides the underlying `fetch`. Production wiring lives in `packages/web/services/api-client.{client,server}.ts`.
- Auth is BFF-style (ADR-0016, ADR-0017, ADR-0018): the Effect server holds the OIDC session cookie. The FE never sees tokens directly.
- A prior plan tried to fake the entire backend in-process by running the real handlers against a `FakeDatabase`. It collapsed under the cost of simulating Postgres semantics (FK constraints, transactions, advisory locks, race conditions). Once any test depended on a fake-only behavior, the fake's fidelity became part of the production contract by accident.
- Effect has a native HTTP-faking primitive (`HttpApiBuilder.group` + `toWebHandler`) that would substitute at the same Layer the production code already abstracts over. It exists, it's documented, but it has no published community ergonomics for FE React Testing Library tests. We would be inventing the patterns alone.

## Decision

**The FE integration tier's fake is at the network boundary, intercepted by MSW (Mock Service Worker).** Tests compose per-scenario handlers from per-feature builders and per-domain fixtures. Handlers are stateless and order-independent; cross-endpoint side effects are not modeled.

Three sub-decisions lock the shape:

### 1. Per-test handlers, not a stateful fake

Each test calls `server.use(...handlers)` with the exact responses its scenario needs. There is no shared in-memory model that survives across handler calls within a test, and no `@mswjs/data`-style entity store. If a scenario needs "POST /users then GET /users returns the new user," that's expressed by registering both handlers explicitly — not by mutating a shared `Map` from inside the POST handler.

Rationale: every experience report on stateful MSW fakes reaches the same regret — the fake becomes a parallel implementation of the backend, and drift between fake and real becomes silent test rot. By forbidding the pattern up-front, we accept some setup verbosity in exchange for keeping the fake's responsibility scoped to "return this response when called."

### 2. Typed handlers derived from `@org/contracts`

A thin `typedHandler(Api.endpoint("Users", "list"), resolver)` wrapper sits between MSW's `http.get/post/put/delete` and test code. The wrapper infers the URL, method, request shape, response shape, and tagged error union from the `HttpApi` endpoint definition. Contract drift becomes a `tsc` error, not a runtime test failure.

The wrapper is not codegen. It is a single ~50-line function. If its types resist clean inference under Effect's current `HttpApi` generics, we fall back to vanilla `http.verb()` strings and rely on the client-side schema decoder to surface drift at runtime. The fallback is acceptable because the contract still bounds the responses on the consuming side.

### 3. Per-feature handler builders + per-domain fixtures

Boilerplate is amortized in two layers:

- **Fixtures** (`packages/web/test/fixtures/<entity>.ts`) — `makeUser({ overrides? })` produces a contract-shape object with sensible defaults. Each fixture has a co-located test that decodes its default output through the contract's response schema. That decode test is the drift gate.
- **Handler builders** (`packages/web/test/handlers/<feature>.ts`) — `usersHandlers.list(users)`, `usersHandlers.create("success" | { error: "UserAlreadyExists" })` — take a scenario outcome and return an MSW handler. Tests compose handlers; they don't write them.

Tests look like:

```ts
server.use(
  ...handlers.auth.signedInAs(makeUser({ role: "admin" })),
  handlers.users.list([]),
  handlers.users.create("success"),
);
```

`server.listen({ onUnhandledRequest: "error" })` is non-negotiable: every test must declare every endpoint it touches.

## Alternatives Considered

### A. In-process backend over `FakeDatabase`

Real backend handlers run via `HttpApiBuilder.toWebHandler` against an in-memory `FakeDatabase`. The FE swaps `FetchHttpClient.Fetch` to call the in-process handler. This is what the abandoned `@org/test-backend` package attempted.

Rejected because:

- Faking Postgres semantics (FK enforcement, transactions, advisory locks, cascade-vs-restrict, unique indexes that span schemas) is a tar pit. Each new test that depended on a database invariant pulled the fake one step further toward "we have two databases now."
- Cross-package coupling — FE test code imports backend modules — entangled the FE and backend release cadences.
- The integration tier and acceptance tier started overlapping in fidelity, defeating the point of having both tiers.

### B. Effect-native handler stubs via `HttpApiBuilder.group`

`HttpApiBuilder.group(Api, "Users", h => h.handle("list", () => Effect.succeed(...)))` per-endpoint stub layer, then `toWebHandler`, then `Layer.succeed(FetchHttpClient.Fetch, ...)`. This substitutes at the same Effect Layer production already abstracts over. Contract drift would be a compile error. The real Effect middleware (request decode, response encode, error tag → status mapping) would run in tests.

Rejected because:

- No published community example of this pattern for FE RTL testing exists. typeonce.dev's Effect course explicitly recommends MSW. We would be authoring the ergonomics alone and committing the template to that experiment.
- The shape of `HttpApiBuilder.group` types under arbitrary endpoint mixes is non-trivial; the spike risk was higher than MSW's well-trodden Vitest integration.
- The advantage (contract drift = compile error) is largely recovered by the `typedHandler` wrapper described above, at lower cost.

Worth revisiting if Effect publishes a worked `HttpApiBuilder.group`-based FE test recipe.

### C. Mocked `ApiClient` shape (`{ user: { find: vi.fn() } }`)

Substitute the `ApiClient` Context.Tag itself with an object whose methods are `vi.fn()`s. Asserts go on `expect(client.user.find).toHaveBeenCalledWith(...)`.

Rejected on Synapse-doc grounds: this is the canonical mockist anti-pattern. Tests assert implementation (which client method was called) instead of behavior (what the user sees). Refactors that change the client surface break tests without changing behavior.

## Consequences

**The integration tier doesn't extend to Playwright.** MSW handlers live in the test process; Playwright drives a browser against a real Next + Effect deployment. Cross-process flows test at the acceptance tier instead. Tier sharing happens through the page driver (UI interactions only); state setup is allowed to diverge between tiers.

**Cross-endpoint flows test twice.** A scenario like "create user, see user in list" is tested at the integration tier with per-call handler responses, and at the acceptance tier against the real backend. Each tier proves something different — the integration test proves the FE behaves correctly given specific server responses; the acceptance test proves the server actually produces those responses.

**No restriction on backend runtime.** The earlier (discarded) plan locked the backend to Node/TypeScript because in-process handlers required a shared runtime. The MSW seam has no such requirement. A future module rewritten in another runtime is unaffected — its FE integration tests still mock at the wire.

**Some setup verbosity is accepted.** A test that exercises three endpoints declares three handlers. Helpers and builders amortize this; the cost is real but bounded.

**Test files live at `packages/web/features/<feature>/__tests__/*.integration.test.tsx`.** Sibling to feature code, separate from presenter tests (`*.presenter.test.tsx`). The `*.integration.test.tsx` suffix mirrors the server-side convention from ADR-0009.

**Shared infrastructure lives at `packages/web/test/`** — private to the web package for now. Promoted to a workspace package only if feature-level Storybook stories appear and need to share fixtures.

## What this ADR does not change

- **ADR-0009 (testing pyramid).** Presenter and acceptance tiers are unchanged. The integration tier is additive — it does not replace either neighbor.
- **ADR-0014 (view tiering).** Presenters and view-models are tested as before. The integration tier exercises them in composition with the route, not in place of their unit tests.
- **ADR-0017, ADR-0018 (auth and renderer).** The session cookie continues to flow from the Effect server through Next. In the integration tier the cookie is irrelevant — MSW intercepts before the cookie matters. The `signedInAs` test helper returns the right `/auth/me` response; that's all the FE needs to consider itself authed.
- **The contract (`@org/contracts`).** Single source of truth, unchanged. The integration tier consumes it through `typedHandler`; the production client consumes it through `HttpApiClient.make`. Same `Api`.
