# ADR-0010: HTTP-only contracts

- Status: Accepted
- Date: 2026-04-24

## Context and Problem Statement

A use case can be exposed via many transports: HTTP (REST), GraphQL, command-line tools, message-queue subscribers. Each additional transport multiplies the adapter surface — payload validation, response serialization, authentication, error mapping all need handling per transport. The cost is real, in code and in mental model.

The forces:

- This codebase is, today, an HTTP server with a single client (a Next.js app — ADR-0018). It is not on a near-term roadmap to be ingested via message queues, scripted via CLI, or queried via GraphQL.
- Speculative transport adapters look small at the time they're added and nobody removes them once the imagined use case fails to materialize.
- HTTP contracts must be sharable between server and client, with a single source of truth for endpoint shapes, payloads, responses, and error variants.
- The use-case layer should not care which transport invoked it; transports are adapters, not architectural strata.

## Decision

This codebase exposes one transport: **HTTP**. Public contracts are declared in a dedicated contracts package using `effect/unstable/httpapi` (`HttpApi`) and Effect Schema. The contracts package has no server or database dependencies and is consumable by the client via workspace resolution.

### Contract structure

Each module gets one contract file in the contracts package:

```
contracts/src/api/
  UserContract.ts      — User group: endpoints, payload/response schemas, HTTP error shapes
  WalletContract.ts
  Contracts.ts         — barrel
contracts/src/DomainApi.ts  — the registered API surface (registers each group)
```

A contract file declares HTTP error classes (`Schema.TaggedErrorClass` annotated with `HttpApiSchema.annotations({ status })`), public-facing schemas, request payloads and responses (`Schema.Class`), and the endpoint group itself (`HttpApiGroup.make(...).add(...)`). Endpoint definitions use an options object (`{ success, payload, params, query, error }`); the request keys are `params` (path) and `query` (querystring).

### Server binding

Each module's `interface/http/` folder contains one `<name>.endpoint.ts` per endpoint plus an `index.ts` barrel (see ADR-0013). Each endpoint implements a single contract endpoint and binds it to use-case calls, typically through the command/query bus (ADR-0006), and is declared with `Effect.fn("<GroupLive.op>")` so it carries its boundary span (ADR-0012):

```ts
// modules/user/interface/http/create.endpoint.ts
export const createEndpoint = Effect.fn("UserHttp.create")(function* (
  request: EndpointRequest<typeof UserContract.Group, "create">,
) {
  const commandBus = yield* CommandBus;
  const id = yield* commandBus.execute(CreateUserCommand.make({ ...request.payload }));
  return new UserContract.CreateUserResponse({ id });
}).pipe(
  Effect.catchTag(
    "UserAlreadyExists",
    (e) => new UserContract.UserAlreadyExistsError({ email: e.email, message: `…` }),
  ),
);
```

The `index.ts` barrel binds each endpoint by name:

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

The stack serves via `HttpApiBuilder.layer(Api)` into an `HttpRouter`, then `HttpRouter.serve(appLayer, { middleware })` (`effect/unstable/http`); CORS and logging are composed as `HttpMiddleware` in the serve `middleware` argument.

### Client binding

The client consumes the same `DomainApi` via `HttpApiClient.make(Api)`. Endpoint discovery, payload encoding, and response decoding are driven by the shared schemas. No codegen, no OpenAPI document, no manual client SDK. `HttpApiClient` encodes a `Schema.Class` payload/params/query **strictly** — call sites construct the contract class instance (`new SomeContract.CreatePayload({...})`), not a structurally-identical plain object (a v4 `HttpApiClient` requirement).

### What is _not_ in this strategy

- No GraphQL resolvers. A future GraphQL need is an adapter under a new file in `interface/` calling the same use cases.
- No CLI commands as a product transport. Same shape: an adapter that calls use cases.
- No message-queue subscribers as a transport. Internal domain events use the in-process bus (ADR-0007).

## Consequences

- Smaller architectural surface. Fewer concepts to learn, fewer files to keep in sync when a contract changes.
- Contracts are typed end-to-end across client and server. The client cannot request an endpoint that doesn't exist; the server cannot return a shape the client doesn't expect. Type drift is a compile error in whichever workspace package is updated last.
- Loss of generality compared to a multi-transport architecture. Acceptable: a second transport is added as an adapter in `interface/`, not by reshaping the architecture.
- The separation between domain errors and contract errors means a domain-error rename does not require a coordinated client release (ADR-0004).
- Static analysis (ADR-0008) ensures the contracts package stays self-contained, so consuming it from the client is always safe.

## Alternatives considered

- **Co-locate contracts inside each module's `interface/`.** Rejected — making the client depend on a server-side module would pull in the Effect runtime, database client, and OTEL SDK transitively.
- **Generate an OpenAPI spec and consume it via codegen.** Rejected — end-to-end TypeScript types via a shared Schema package are stronger and easier to maintain. An OpenAPI document can be generated as an additional artifact if an out-of-workspace consumer ever appears.
- **Add GraphQL or CLI now to mirror a multi-transport reference.** Rejected — speculative complexity.

## Related

- ADR-0004 (errors) — the domain-vs-contract error split that lives at this boundary.
- ADR-0006 (typed bus) — what the HTTP endpoints call into.
- ADR-0008 (architecture enforcement) — the rules that keep the contracts package free of server dependencies.
- ADR-0013 (HTTP endpoint file conventions) — how the per-module `interface/http/` folder is organized, and how test parity is enforced.
