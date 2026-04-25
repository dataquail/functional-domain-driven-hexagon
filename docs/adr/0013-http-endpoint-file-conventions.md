# ADR-0013: HTTP endpoint file conventions and test parity

- Status: Accepted
- Date: 2026-04-25

## Context and Problem Statement

ADR-0010 establishes that the server binds contract endpoints in `modules/<feature>/interface/`. It does not say _how_ those bindings are organized within the folder. The naive shape — one `<feature>-http-live.ts` file that calls `HttpApiBuilder.group(...)` and chains `.handle("name", (request) => ...)` once per endpoint, with each handler body inlined — works for two or three endpoints and decays from there. The user module already had four endpoints in 100 lines, with no clear "what implements `user.find`?" answer beyond scrolling. Modules that grow past a handful of operations turn the file into a wall.

The forces:

- A file's length should track the size of its single responsibility. A file responsible for "wire the user group" is short; a file responsible for "implement every user endpoint" grows monotonically. The two responsibilities should not share a file.
- Finding the implementation of a named endpoint should be a filename match, not a search inside a long file.
- The contract is the source of truth for endpoint shapes. Server-binding code should not duplicate the request envelope type — when the contract gains a header, payload field, or path param, the binding's parameter type should update automatically.
- Per-endpoint testing is the natural granularity for HTTP integration tests: one suite of tests per endpoint, with assertions about that endpoint's success, error variants, and side effects. A single multi-endpoint test file mixes concerns and obscures coverage.
- "Every endpoint has a test" is a property the architecture should enforce, not a convention people remember.

## Decision

### One file per endpoint

Each endpoint declared in a contract group has its own file in `modules/<feature>/interface/`, named `<endpoint>.endpoint.ts`. The file exports a single function — the endpoint implementation — named `<endpoint>Endpoint`. Naming uses the endpoint name from the contract verbatim (`find`, `create`, `delete`, `changeRole` → `find.endpoint.ts`, `change-role.endpoint.ts` after kebab-casing). Parity with the contract endpoint name makes "what implements `user.find`?" mechanical to find.

### "Endpoint", not "handler"

The implementing function is an _endpoint_, matching `HttpApiEndpoint` in the contract. "Handler" is the Express tradition and reads as "thing that adapts request bytes," which is one layer below what these files do. The contract names them endpoints; the implementation files do too.

### Endpoints take the full request

Each endpoint function takes the full request envelope as its sole argument:

```ts
export const findEndpoint = (request: EndpointRequest<typeof UserContract.Group, "find">) =>
  Effect.gen(function* () { ... });
```

The request envelope is derived from the contract via a generic helper in `platform/`:

```ts
export type EndpointRequest<G, Name> = HttpApiEndpoint.HttpApiEndpoint.Request<
  HttpApiEndpoint.HttpApiEndpoint.WithName<HttpApiGroup.HttpApiGroup.Endpoints<G>, Name>
>;
```

Composes Effect's existing type extractors. The endpoint's parameter type is computed from the contract group and the endpoint name; it stays in sync automatically. Adding a header or payload field to the contract endpoint flows through to every implementation file's parameter type without manual annotation.

### Group registration is pure wiring

A single `<feature>-http-live.ts` file per module imports each endpoint and binds it to the contract by name:

```ts
export const UserHttpLive = HttpApiBuilder.group(Api, "user", (handlers) =>
  handlers
    .handle("find", findEndpoint)
    .handle("create", createEndpoint)
    .handle("delete", deleteEndpoint)
    .handle("changeRole", changeRoleEndpoint),
);
```

No deconstruction, no logic. Each `.handle` binds a name to an implementation function. Adding an endpoint is a two-line change here plus a new endpoint file.

### Test parity is enforced

Each `<endpoint>.endpoint.ts` must have a sibling `<endpoint>.endpoint.integration.test.ts` (or `<endpoint>.endpoint.test.ts` for the rare unit-only case). A repository-root script `scripts/check-test-parity.mjs` globs all `*.endpoint.ts` files and verifies the sibling test file exists. The script is wired as `pnpm lint:tests` and runs in `pnpm check:all` alongside `lint:deps`.

dependency-cruiser (ADR-0008) cannot express "for every file matching X there must exist a sibling matching Y" — it checks edges in the import graph, not file existence. The two tools complement each other: depcruise enforces _what_ a file may depend on; the parity script enforces _that a test file exists_. Both fail CI; both have explicit error output that points at the missing artifact.

The parity script is structured around a `rules` array so the same parity check can be extended to commands, queries, and event handlers when desired. Today it covers HTTP endpoints only; the file is small enough that adding rule entries is a one-line change.

### Tests own their HTTP setup via a shared helper

Each per-endpoint test file uses `useServerTestRuntime(["users"])` from `test-utils/`. The helper wires `ManagedRuntime.make(TestServerLive)`, `beforeAll` / `afterAll`, and `beforeEach`-truncate into the surrounding describe block, returning a `run` function for executing test effects. The boilerplate that would otherwise repeat across N endpoint test files lives in one place. Integration tests do _not_ import endpoint files directly; they exercise the contract via `HttpApiClient.make(Api)`, which is what the parity rule guarantees a test exists for, not what the test asserts about.

## Consequences

- Endpoint files are short. Each one does one thing: implement one endpoint. Reviewing a change to the user-create flow means reading one file, not scrolling past three other endpoints.
- The group registration file stays small as a module's endpoint count grows. It is purely declarative wiring — its length scales linearly with endpoint count, but each line is one binding.
- Adding an endpoint is a four-step change: add the contract endpoint, create `<name>.endpoint.ts`, create `<name>.endpoint.integration.test.ts`, register in the group file. The parity check fails CI if the test file is omitted.
- The contract drives the implementation's request type. A breaking contract change surfaces as a TypeScript error in the implementation file, not at runtime.
- A small `EndpointRequest<G, Name>` helper lives in `platform/` and is reused by every endpoint file. It is deliberately generic: when other modules' interface folders are populated, they reuse the same helper.
- The naming `<name>.endpoint.ts` and `<name>.endpoint.integration.test.ts` is mechanical. The parity script depends on the suffixes; renames must keep them in lockstep.
- The test-parity script is one more lint step. It runs in milliseconds and fails fast with explicit "expected one of: …" output. The cost is negligible; the protection scales with the codebase.

## Alternatives considered

- **Single `<feature>-http-live.ts` with all endpoints inlined.** The previous shape. Rejected because file length grows monotonically with endpoint count and "what implements `X`?" becomes a search inside a wall of code rather than a filename match.
- **Endpoint takes deconstructed args** (e.g. `findEndpoint(urlParams)` instead of `findEndpoint(request)`). Considered briefly because it lets each endpoint advertise only what it consumes. Rejected because it pushes deconstruction logic into the registration file (the file should be pure wiring) and creates a two-file change every time the request envelope of an endpoint grows.
- **"Handler" as the file/function name.** Rejected because the contract calls these endpoints; aligning the implementation's vocabulary with the contract's reduces translation cost when a developer moves between the two. "Handler" reads as a lower-level concept (request-byte adaptation) than what these files actually do.
- **Per-endpoint Layer composition** (each endpoint exports its own Layer, the group is built by merging them). `HttpApiBuilder` does not support this — a group must be assembled in one `HttpApiBuilder.group(...)` call. The chosen shape achieves the same separation with normal function imports and one thin group-registration file.
- **Enforce test parity via dependency-cruiser.** depcruise checks edges in the dependency graph; "this file must exist" is not expressible. A reachability rule like "every endpoint must be reachable from a test" was considered but the integration tests don't actually import the endpoint — they go through `HttpApiClient`, so reachability isn't the right property. A small custom script is the right tool here; the cost is the same as one more lint rule.
- **Skip the parity rule, rely on code review.** Rejected for the same reason ADR-0008 rejects "no enforcement, rely on code review." A rule on paper is not a rule; the first time a contributor adds an endpoint without a test in a hurry, the convention is gone.

## Related

- ADR-0008 (architecture enforcement) — depcruise covers import-graph rules; the parity script covers file-existence rules. Together they form the architectural-rule lint pipeline.
- ADR-0009 (testing pyramid) — the per-endpoint integration test is the HTTP E2E test described there.
- ADR-0010 (HTTP-only contracts) — the contract shape these endpoint files implement.
