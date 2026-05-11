# ADR-0020 — `platform/ids/` governance

Date: 2026-05-10
Status: Accepted

## Context

`packages/server/src/platform/ids/` is the minimal shared kernel for
branded entity IDs that cross module boundaries. It currently holds a
single file, `user-id.ts`, which exports `UserId` — referenced by
`wallet` (FK), `todos` (current user), and `auth` (the identity row's
target user).

The shared-kernel pattern is intentional (ADR-0002 has the long
form): cross-module ID references need a stable, dependency-free
location so two modules don't redeclare the same brand and drift. The
folder is narrowly allowlisted in `.dependency-cruiser.cjs` — domain
folders are otherwise sealed.

What's missing is **governance**. Newman's "minimal stable shared
kernel" guidance and Vernon's "anti-corruption layer" both warn that
shared kernels grow into dumping grounds without explicit rules. This
ADR locks in those rules before the second file lands.

## Decision

### What's allowed in `platform/ids/`

- **Branded UUID types** whose corresponding aggregate lives in
  another module, defined as
  `Schema.UUID.pipe(Schema.brand("<Name>Id"))`.
- Nothing else.

### What's not allowed

- Value objects (`Address`, `Money`, `Email`). These live in the
  owning module's `domain/`.
- Serialized shapes, DTOs, request/response payloads. Those are
  contracts, not IDs.
- Validation rules, predicates, parsing helpers. A branded ID's only
  job is to mark a string at the type level.
- Helper functions of any kind.
- Module-internal IDs. If only one module references the ID, the ID
  stays in `<module>/domain/`.

### Adding a new ID

- Add a new file only when a **second** module needs to reference an
  ID owned by an existing aggregate. Single-module IDs stay in
  `<module>/domain/<thing>-id.ts`.
- The PR adding the new file must name both consumers in the PR
  description. Reviewers reject the addition if only one cross-module
  consumer can be named.

### Audit policy

- Periodic sweep (at least once per major refactor) removes IDs that
  are now referenced by exactly one module. Such an ID is "no longer
  cross-module" — it moves back to that module's `domain/`.
- The sweep is mechanical: grep for `platform/ids/<file>` imports,
  count distinct module roots, move when count == 1.

### Mechanical enforcement

A new `platform-ids-effect-only` dependency-cruiser rule restricts
the folder to effect-only third-party imports. Content discipline
(branded IDs only) still requires PR review, but the rule blocks
accidental drift toward third-party-coupled shapes (e.g. Drizzle
column types leaking in).

## Consequences

- The shared kernel stays a one-line-per-file folder for the
  foreseeable future. That's by design.
- New cross-module IDs are still cheap to add — one file, one PR,
  reviewer scans for two distinct consumer modules.
- If a future ID has a meaningful schema (e.g. a UUID with a checksum
  byte), the rule still permits it: it's still `Schema.X.pipe(Schema.brand(...))`,
  and the brand is the public surface.
- ADR-0002 (typed-ID shared kernel addendum) remains the rationale
  for _why_ the folder exists; this ADR is purely about _what stays
  in it_.

## Alternatives considered

- **Eliminate the folder; each module redefines its own brand.**
  Rejected: two modules would each have their own `UserId` brand, and
  TypeScript would happily accept them as different types. Cross-FK
  passing would require coercion at every boundary.
- **Move IDs into `@org/contracts`.** Rejected: contracts are the
  HTTP wire shape and live in a separate package consumed by both the
  server and the web client. Branded IDs are a server-internal
  invariant — pulling them into contracts would either leak the brand
  to the client (where it's meaningless) or duplicate it.
- **Allow value objects in `platform/ids/`.** Rejected: value objects
  carry semantic invariants (e.g. `Email` validation) that belong with
  the aggregate that owns them. Splitting them into a shared kernel
  creates two places for the same concept to evolve.
