# ADR-0021 — Per-module database schemas

Date: 2026-05-18
Status: Accepted

## Context

ADR-0001 establishes hexagonal modules with sealed boundaries: cross-module
access flows through `index.ts` barrels at the type level and through the
synchronous event bus at runtime (ADR-0007). Dependency-cruiser enforces the
TypeScript boundary; the bus provides the runtime ACL.

Until now there was **no equivalent enforcement at the persistence layer**.
Every module's tables lived in the default `public` schema, and every
repository wrote SQL like `SELECT * FROM users` / `INSERT INTO wallets …`.
Two failure modes followed from this:

1. **Implicit cross-module reads in SQL are undetectable.** A handler in
   `modules/wallet/` writing `SELECT … FROM users JOIN wallets …` is a
   physical violation of the module boundary that nothing in the codebase
   would flag — not dep-cruise (no import to inspect), not the bus (no
   dispatch to observe), not tests (the query would succeed against a
   shared schema).
2. **No structural reminder of ownership.** A developer adding a new query
   has no on-screen signal that `users` belongs to `user` and `wallets`
   belongs to `wallet`. Unqualified table names invite the assumption that
   "all tables are equally available."

Both failure modes existed only because the persistence layer was undivided.

## Decision

### Each module owns a Postgres schema named after its module folder

| Module folder | Schema   | Tables                                  |
| ------------- | -------- | --------------------------------------- |
| `user`        | `user`   | `user.users`                            |
| `todos`       | `todos`  | `todos.todos`                           |
| `wallet`      | `wallet` | `wallet.wallets`                        |
| `auth`        | `auth`   | `auth.auth_identities`, `auth.sessions` |

Migrations live in `packages/database/migrations/` as one-thing-per-file
Flyway-versioned SQL: `V001__create_schema_user.sql`,
`V002__create_schema_organization.sql`, etc. FK dependencies dictate the
order — every `CREATE SCHEMA` lands before any `CREATE TABLE`, and any
table that references another table's id (including cross-schema) is
numbered after the referenced table.

### All application SQL must be schema-qualified

Repositories, queries, jobs, and any other SQL site must address tables by
their owning schema: `"user".users`, `todos.todos`, `wallet.wallets`,
`auth.auth_identities`, `auth.sessions`. The double-quotes on `"user"` are
required because `user` is a Postgres reserved word.

### Cross-schema foreign keys are allowed at DDL only

Postgres permits FKs across schemas, and we keep three of them as a physical
safety net against orphans:

```
wallet.wallets.user_id        → user.users.id  ON DELETE CASCADE
auth.auth_identities.user_id  → user.users.id  ON DELETE CASCADE
auth.sessions.user_id         → user.users.id  ON DELETE CASCADE
```

This is the **only** cross-schema reference we tolerate. Application SQL
must never JOIN, SELECT, INSERT, UPDATE, or DELETE across schemas. Reads
across module boundaries continue to flow through the synchronous event bus
(ADR-0007) and the inbound event adapters (ADR-0007 ACL).

### Static enforcement via `@synapsestudios/eslint-plugin-data-boundaries`

The rule `no-cross-schema-slonik-access` is configured in
`eslint.config.mjs` with `modulePath: "/modules/"`. For any file under
`packages/server/src/modules/<name>/`, the rule:

- Requires fully-qualified table names in slonik tagged templates.
- Forbids access to tables in any schema other than `<name>`.

`packages/server/src/test-utils/` and `packages/jobs/src/test-utils/` are
**not** scoped by the rule — they legitimately TRUNCATE across schemas to
reset state between tests. The lint scope is also restricted to non-test
files because integration tests sometimes seed via raw SQL into the owning
module's neighbour (e.g. `wallet` tests seeding a `user.users` row through
`@org/database` rather than the user repository).

### Test harness convention

`truncate(...)` in both test-utils packages now requires
`"schema.table"` qualified strings. Mis-qualified inputs throw at runtime
with a message explaining the contract. The test runtime drops every module
schema before replaying migrations from scratch.

## Consequences

**Positive**

- Cross-module persistence coupling is now flagged at lint time, joining
  imports (dep-cruise) and runtime (event bus) in the boundary-enforcement
  set.
- The ownership of a table is visible in every query. `wallet.wallets`
  cannot be confused for a shared table.
- Migration files are scoped: each file does one DDL action, easing review
  and history.

**Negative / trade-offs**

- Adding a new table to an existing module still requires adding both a
  `create_table_*.sql` and a sibling migration if a FK to another module's
  table is needed. The latter must reference the foreign schema explicitly.
- A new module requires a `create_schema_<name>.sql` migration AND
  appending `<name>` to `MODULE_SCHEMAS` in both `test-database.ts` files
  (server + jobs). This duplication is acceptable because `@org/jobs` must
  not depend on `@org/server`. If a third consumer appears, promote
  `test-database.ts` to a shared `@org/test-utils` package as the
  duplicated comment already calls out.
- Down (`U__`) migrations are deliberately **not** authored. Flyway OSS
  does not apply them, and on a template repo the convention is to wipe
  and replay rather than incrementally roll back.

## Alternatives considered

- **Schemas + drop cross-schema FKs entirely.** Pure logical decoupling.
  Rejected: a wallet without a user is a money-shaped bug; the physical
  safety net is cheap insurance and does not introduce coupling beyond
  what already existed.
- **No schemas; rely on a custom dep-cruise rule that parses SQL strings.**
  Rejected: parsing arbitrary tagged-template SQL is fragile and would not
  catch dynamic identifiers. Per-module schemas make the constraint
  structural.
- **Switch off Flyway to dbmate / node-pg-migrate to get OSS down migrations.**
  Rejected as out of scope; the value-per-effort of schemas + lint is much
  higher than down-migration tooling on a template repo.

## Cross-references

- ADR-0001: hexagonal module layout (the boundary we're now also enforcing at
  the DB).
- ADR-0007: synchronous event bus + interface/events ACL (the legitimate
  cross-module read seam).
- ADR-0008: dependency-cruiser sibling-isolation rules (the import-layer
  equivalent of this rule).
