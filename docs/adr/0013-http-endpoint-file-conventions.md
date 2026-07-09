# ADR-0013: HTTP endpoint file conventions and test parity

- Status: Accepted
- Date: 2026-04-25

## Context and Problem Statement

ADR-0010 establishes that the server binds contract endpoints in `modules/<feature>/interface/http/`. It does not say _how_ those bindings are organized within the folder. The naive shape — one file that calls `HttpApiBuilder.group(...)` and chains `.handle("name", (request) => ...)` once per endpoint, with each handler body inlined — works for two or three endpoints and decays from there. The user module's four endpoints already ran to 100 lines with no clear "what implements `user.find`?" answer beyond scrolling.

The forces:

- A file's length should track the size of its single responsibility. A file responsible for "wire the user group" is short; a file responsible for "implement every user endpoint" grows monotonically. The two responsibilities should not share a file.
- Finding the implementation of a named endpoint should be a filename match, not a search inside a long file.
- The contract is the source of truth for endpoint shapes. Server-binding code should not duplicate the request envelope type — when the contract gains a header, payload field, or path param, the binding's parameter type should update automatically.
- Per-endpoint testing is the natural granularity for HTTP integration tests.
- "Every endpoint has a test" is a property the architecture should enforce, not a convention people remember.

## Decision

### One file per endpoint

Each endpoint declared in a contract group has its own file in `modules/<feature>/interface/http/`, named `<endpoint>.endpoint.ts`. The file exports a single function — the endpoint implementation — named `<endpoint>Endpoint`. Naming uses the endpoint name from the contract verbatim (`find`, `create`, `delete`, `changeRole` → `find.endpoint.ts`, `change-role.endpoint.ts` after kebab-casing). Parity with the contract endpoint name makes "what implements `user.find`?" mechanical to find.

### "Endpoint", not "handler"

The implementing function is an _endpoint_, matching `HttpApiEndpoint` in the contract. "Handler" is the Express tradition and reads as "thing that adapts request bytes," which is one layer below what these files do. The contract names them endpoints; the implementation files do too.

### Endpoints take the full request and carry their boundary span

Each endpoint function takes the full request envelope as its sole argument and is declared with `Effect.fn("<GroupHttp.op>")` so it carries its boundary span (ADR-0012):

```ts
export const findEndpoint = Effect.fn("UserHttp.find")(function* (
  request: EndpointRequest<typeof UserContract.Group, "find">,
) { ... });
```

The request envelope is derived from the contract via a generic helper in `platform/`:

```ts
export type EndpointRequest<G, Name> = HttpApiEndpoint.HttpApiEndpoint.Request<
  HttpApiEndpoint.HttpApiEndpoint.WithName<HttpApiGroup.HttpApiGroup.Endpoints<G>, Name>
>;
```

The endpoint's parameter type is computed from the contract group and the endpoint name; it stays in sync automatically. Adding a header or payload field to the contract flows through to every implementation file's parameter type without manual annotation.

### Group registration is pure wiring, in `index.ts`

The folder's `index.ts` barrel imports each endpoint and binds it to the contract by name (a group is assembled in one `HttpApiBuilder.group(...)` call):

```ts
// modules/user/interface/http/index.ts
export const UserHttpLive = HttpApiBuilder.group(Api, "user", (handlers) =>
  handlers
    .handle("find", findEndpoint)
    .handle("create", createEndpoint)
    .handle("delete", deleteEndpoint)
    .handle("changeRole", changeRoleEndpoint),
);
```

No deconstruction, no logic. Adding an endpoint is a two-line change here plus a new endpoint file.

### Test parity is enforced by the folder-structure rule

Each `<endpoint>.endpoint.ts` must have a sibling `<endpoint>.endpoint.integration.test.ts`. This is one required-sibling obligation in the `project-structure/folder-structure` ESLint rule (`eslint.project-structure.mjs`, run under `pnpm lint` — ADR-0008), which resolves the sibling against the real filesystem. dependency-cruiser cannot express "for every file matching X there must exist a sibling matching Y" — it checks edges, not file existence — so the file taxonomy is the ESLint rule's job and the import graph is dependency-cruiser's.

Because the rule's `enforceExistence` is AND-only (no "either sibling"), endpoints carry **one canonical requirement**: `*.endpoint.integration.test.ts`, which exercises the real HTTP layer against a live database via `useServerTestRuntime(...)`. Two exceptions, encoded as explicitly named rules:

- The OIDC `login` and `logout` endpoints are **exempted** — their happy path needs a live identity provider and is covered by Playwright + the session-repository integration tests.
- `callback` has a real `callback.endpoint.integration.test.ts` for its reachable no-IdP guard.

A file ending `*.endpoint.test.ts` (no `integration`) is a deliberate unit token whose meaningful coverage lives elsewhere; it must carry a header comment naming where. If such a test starts hitting real HTTP + DB, rename it to `.endpoint.integration.test.ts`.

### Tests own their HTTP setup via a shared helper

Each per-endpoint test file uses `useServerTestRuntime(["users"])` from `test-utils/`, which wires `ManagedRuntime.make(TestServerLive)`, `beforeAll`/`afterAll`, and per-test truncate into the surrounding describe block. Integration tests do _not_ import endpoint files directly; they exercise the contract via `HttpApiClient.make(Api)`, which is what the parity rule guarantees a test exists for.

## Consequences

- Endpoint files are short. Each does one thing. Reviewing a change to the user-create flow means reading one file.
- The `index.ts` group registration stays small as a module's endpoint count grows — purely declarative wiring, one line per binding.
- Adding an endpoint is a four-step change: add the contract endpoint, create `<name>.endpoint.ts`, create `<name>.endpoint.integration.test.ts`, register in `index.ts`. `pnpm lint` fails if the test file is omitted.
- The contract drives the implementation's request type. A breaking contract change surfaces as a TypeScript error in the implementation file, not at runtime.
- The naming `<name>.endpoint.ts` / `<name>.endpoint.integration.test.ts` is mechanical and is the parity detector; renames must keep the suffixes in lockstep.

## Alternatives considered

- **Single group file with all endpoints inlined.** Rejected because file length grows monotonically with endpoint count and "what implements X?" becomes a search inside a wall of code.
- **Endpoint takes deconstructed args** (e.g. `findEndpoint(urlParams)`). Rejected — pushes deconstruction into the registration file and creates a two-file change every time an endpoint's request envelope grows.
- **"Handler" as the file/function name.** Rejected — the contract calls these endpoints; aligning vocabulary reduces translation cost.
- **Per-endpoint Layer composition.** `HttpApiBuilder` requires a group be assembled in one call; the chosen shape achieves the same separation with normal function imports and one thin `index.ts`.
- **Enforce parity via dependency-cruiser.** Rejected — "this file must exist" is not expressible as an edge rule; the integration tests go through `HttpApiClient`, so reachability isn't the right property. The folder-structure ESLint rule is the right tool.

## Related

- ADR-0008 (architecture enforcement) — dependency-cruiser covers import-graph rules; the folder-structure ESLint rule covers file-existence rules.
- ADR-0009 (testing pyramid) — the per-endpoint integration test is the HTTP E2E test described there.
- ADR-0010 (HTTP-only contracts) — the contract shape these endpoint files implement.
- ADR-0024 (dot-delimited filenames) — the `.endpoint` / `.endpoint.integration.test` naming.
