# ADR-0010: HTTP-only contracts

- Status: Accepted
- Date: 2026-04-24

## Context and Problem Statement

A use case can be exposed via many transports: HTTP (REST), GraphQL, command-line tools, message-queue subscribers. Each additional transport multiplies the adapter surface — payload validation, response serialization, authentication, error mapping all need to be handled per transport. The cost is real, both in code and in mental model.

The forces:

- This codebase is, today, an HTTP server with a single client (a React app). It is not now and is not on a near-term roadmap to be ingested via message queues, scripted via CLI, or queried via GraphQL.
- Speculative transport adapters are the kind of thing that look small at the time they're added and that nobody removes once the imagined use case fails to materialize.
- HTTP contracts must be sharable between server and client, with a single source of truth for endpoint shapes, payloads, responses, and error variants.
- The use-case layer should not care which transport invoked it; transports are adapters, not architectural strata.

## Decision

This codebase exposes one transport: **HTTP**. Public contracts are declared in a dedicated contracts package using `@effect/platform/HttpApi` and Effect Schema. The contracts package has no server or database dependencies and is consumable by the client via workspace resolution.

### Contract structure

Each module gets one contract file in the contracts package:

```
contracts/src/api/
  UserContract.ts      — User group: endpoints, payload/response schemas, HTTP error shapes
  WalletContract.ts
  Contracts.ts         — barrel
contracts/src/DomainApi.ts  — the registered API surface (registers each group)
```

A contract file declares:

- HTTP error classes (`Schema.TaggedError` annotated with `HttpApiSchema.annotations({ status })` so the API serializer assigns the correct HTTP status automatically).
- Public-facing schemas (e.g. domain types as they appear over the wire).
- Request payloads and responses (`Schema.Class`).
- The endpoint group itself (`HttpApiGroup.make(...).add(...)`).

### Server binding

Each module's `interface/<feature>-http-live.ts` binds the contract endpoints to use-case calls (typically through the command/query bus from ADR-0006):

```ts
HttpApiBuilder.group(Api, "user", (handlers) =>
  handlers
    .handle("create", (request) =>
      Effect.gen(function* () {
        const commandBus = yield* CommandBus;
        const id = yield* commandBus.execute(CreateUserCommand.make({ ... }));
        return new UserContract.CreateUserResponse({ id });
      }).pipe(
        Effect.catchTag("UserAlreadyExists", (e) =>
          Effect.fail(new UserContract.UserAlreadyExistsError({ ... })),
        ),
      ),
    ),
)
```

### Client binding

The client consumes the same `DomainApi` via `HttpApiClient.make(Api)`. Endpoint discovery, payload encoding, and response decoding are all driven by the shared schemas. There is no codegen step, no OpenAPI document, no manual client SDK.

### What is _not_ in this strategy

- No GraphQL resolvers. If a future use case needs GraphQL, an adapter under a new file in `interface/` calls the same use cases. The use-case layer doesn't need to be reshaped for it.
- No CLI commands. Same shape: an adapter that calls use cases.
- No message-queue subscribers as a transport. Internal domain events use the in-process bus (ADR-0007). Cross-process integration events would be a separate, additive mechanism if and when the need arises.

## Consequences

- Smaller architectural surface. Fewer concepts for a new contributor to learn, fewer files to keep in sync when a contract changes.
- Contracts are typed end-to-end across client and server. The client cannot request an endpoint that doesn't exist; the server cannot return a shape the client doesn't expect. Type drift between client and server is a compile error in whichever workspace package is updated last.
- Loss of generality compared to a multi-transport architecture. Acceptable: when (or if) a second transport is needed, it is added as an adapter in `interface/`, not by reshaping the architecture.
- The separation between domain errors (in `modules/<f>/domain/`) and contract errors (in the contracts package) means a domain-error rename does not require a coordinated client release. See ADR-0004.
- Static analysis (ADR-0008) ensures the contracts package stays self-contained: it cannot import from the server or database packages, so consuming it from the client is always safe.

## Alternatives considered

- **Co-locate contracts inside each module's `interface/`.** Rejected — making the client depend on a server-side module would pull in the Effect runtime, the database client, and the OpenTelemetry SDK transitively. The contracts must live in a package with no server runtime dependencies.
- **Generate an OpenAPI spec and have the client consume it via codegen.** Rejected — end-to-end TypeScript types via a shared Schema package are stronger and easier to maintain than a spec-then-codegen pipeline. There is no API consumer outside the workspace today; if there is one in the future, an OpenAPI document can be generated as an additional artifact alongside the typed client.
- **Add GraphQL or CLI now to mirror a multi-transport reference.** Rejected — speculative complexity. The use-case layer is transport-agnostic; adding a transport later is a localized change to `interface/`.

## Related

- ADR-0004 (errors) — the domain-vs-contract error split that lives at this boundary.
- ADR-0006 (typed bus) — what the HTTP handlers call into.
- ADR-0008 (architecture enforcement) — the rules that keep the contracts package free of server dependencies.
