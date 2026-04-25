# ADR-0004: Errors as Schema.TaggedError; no Result wrappers

- Status: Accepted
- Date: 2026-04-24

## Context and Problem Statement

Errors in TypeScript are conventionally thrown, which makes them invisible at the type level: a function's signature says nothing about what it can fail with. Many architectures address this by wrapping return values in a `Result<T, E>` (or `Either<E, T>`) type, so that errors become part of the function's signature.

Effect's `Effect<A, E, R>` already encodes the failure type as the second type parameter. Adding a `Result` wrapper on top of an Effect would be redundant — both mechanisms exist to surface errors to the type system, and Effect's is first-class.

We also need:

- HTTP responses with the right status codes for known error cases.
- Internal error renames not to leak to clients of the public API.
- A bright line between "this is a known business outcome" (e.g. user already exists) and "the system is in an unexpected state" (e.g. a database row failed to decode).

## Decision

### Domain errors

Domain errors are `Schema.TaggedError` classes co-located with the aggregate they belong to. They appear in the use-case's `E` channel.

```ts
export class UserAlreadyExists extends Schema.TaggedError<UserAlreadyExists>("UserAlreadyExists")(
  "UserAlreadyExists",
  { email: Schema.String },
) {}
```

### Contract errors

HTTP-facing errors are _separate_ `Schema.TaggedError` classes declared as part of the public contract package, annotated with `HttpApiSchema.annotations({ status })` so that the API serializer assigns the correct HTTP status automatically.

```ts
export class UserAlreadyExistsError extends Schema.TaggedError<UserAlreadyExistsError>(
  "UserAlreadyExistsError",
)(
  "UserAlreadyExistsError",
  { email: Schema.String, message: Schema.String },
  HttpApiSchema.annotations({ status: 409 }),
) {}
```

### Translation at the boundary

The interface layer (the HTTP handler) catches each domain error and re-throws as the contract's HTTP error variant via `Effect.catchTag`. This is the only place those two error sets meet:

```ts
.handle("create", (request) =>
  createUser(...).pipe(
    Effect.catchTag("UserAlreadyExists", (e) =>
      Effect.fail(new UserContract.UserAlreadyExistsError({
        email: e.email,
        message: `A user with email ${e.email} already exists`,
      })),
    ),
  ),
)
```

### Defects

Defects (unrecoverable failures: connection errors at the wrong moment, schema decode failures from the database, programmer bugs) are _not_ in `E`. They are surfaced as `Effect.die`, which propagates as a defect rather than a typed failure. The HTTP layer renders them as 500 responses; the trace records the cause. The exhaustive type checker on `E` is not asked to handle them.

## Consequences

- No `Ok`/`Err` wrapping anywhere. Effect's error channel does the same job inline, with first-class composition (`Effect.catchTag`, `Effect.catchTags`, `Effect.mapError`).
- Two error classes per error case (domain + contract). Real boilerplate. Accepted in exchange for not leaking internal types into the public API: a domain error can be renamed without affecting any client.
- HTTP serialization is automatic via `HttpApiSchema.annotations({ status })`. No exception interceptor or error mapper layer needed.
- Exhaustive error handling at the boundary is checked by the type system. If a use case adds a new error variant to its `E` channel, the HTTP handler fails to compile until it catches the new tag.
- The distinction between domain errors (typed in `E`) and defects (`Effect.die`) forces a deliberate choice every time an error case is added: is this a known business outcome or an indication that something's broken? That's the right question to be asking.

## Alternatives considered

- **Single shared error class hierarchy** for both domain and HTTP. Rejected — couples internal modeling to external API; renames cascade.
- **Convert all domain errors to defects, render at the boundary by `instanceof`.** Rejected — loses static exhaustiveness, makes "what can this fail with" impossible to discover from a function's signature.
- **`Result<T, E>` wrappers on use-case return values.** Rejected — duplicates what the Effect error channel already provides, and forces every consumer to unwrap before doing anything useful.
- **Stringly-typed error codes** (a single `code: "USER.ALREADY_EXISTS"` field on a generic error type). Rejected — defeats the type checker's ability to enforce exhaustive handling and substitutes string discipline for compile-time guarantees.

## Related

- ADR-0010 (HTTP-only contracts) defines where the contract errors live and how they get registered with the API.
- ADR-0006 (typed bus) preserves these error types end-to-end when the call goes through the command bus.
