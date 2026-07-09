# ADR-0020: Per-module database schemas

- Status: Accepted
- Date: 2026-05-18

## Context

ADR-0002 establishes hexagonal modules with sealed boundaries: cross-module access flows through `index.ts` barrels at the type level and through the synchronous event bus at runtime (ADR-0007). Dependency-cruiser enforces the TypeScript boundary; the bus provides the runtime ACL. There must be an equivalent enforcement at the persistence layer.

If every module's tables lived in a shared `public` schema and every repository wrote `SELECT * FROM users` / `INSERT INTO wallets …`, two failure modes follow:

1. **Implicit cross-module reads in SQL are undetectable.** A handler in `modules/wallet/` writing `SELECT … FROM users JOIN wallets …` is a physical violation of the module boundary that nothing would flag — not dep-cruise (no import to inspect), not the bus (no dispatch to observe), not tests (the query succeeds against a shared schema).
2. **No structural reminder of ownership.** A developer adding a query has no on-screen signal that `users` belongs to `user` and `wallets` belongs to `wallet`. Unqualified table names invite "all tables are equally available."

Both failure modes exist only because the persistence layer is undivided.

## Decision

### Each module owns a Postgres schema

Each feature module owns a Postgres schema; application SQL addresses tables by their owning schema. The one non-eponymous case is roles: they are platform-level data, so the `role` module's table lives in a shared `platform` schema.

| Module folder  | Schema         | Tables                                                                              |
| -------------- | -------------- | ----------------------------------------------------------------------------------- |
| `user`         | `user`         | `user.users`                                                                        |
| `organization` | `organization` | `organization.organizations`, `.memberships`, `.invitations`, `.organization_roles` |
| `todos`        | `todos`        | `todos.todos`                                                                       |
| `wallet`       | `wallet`       | `wallet.wallets`                                                                    |
| `auth`         | `auth`         | `auth.auth_identities`, `auth.sessions`, `auth.api_tokens`, `auth.device_grants`    |
| `billing`      | `billing`      | `billing.subscriptions`, `billing.webhook_events`                                   |
| `role`         | `platform`     | `platform.roles` (platform-level, cross-cutting)                                    |

Migrations live in `packages/database/migrations/` as one-thing-per-file Flyway-versioned SQL (ADR-0011): `V001__create_schema_user.sql`, `V007__create_table_user_users.sql`, etc. FK dependencies dictate the order — every `CREATE SCHEMA` lands before any `CREATE TABLE`, and any table that references another table's id (including cross-schema) is numbered after the referenced table.

### All application SQL must be schema-qualified

Repositories, queries, jobs, and any other SQL site must address tables by their owning schema: `"user".users`, `todos.todos`, `wallet.wallets`, `auth.auth_identities`, `platform.roles`. The double-quotes on `"user"` are required because `user` is a Postgres reserved word.

### Cross-schema foreign keys are allowed at DDL only

Postgres permits FKs across schemas, and we keep a handful as a physical safety net against orphans — chiefly the several `*.user_id → user.users.id ON DELETE CASCADE` references (wallet, auth, organization membership). This is the **only** cross-schema reference we tolerate. Application SQL must never JOIN, SELECT, INSERT, UPDATE, or DELETE across schemas. Reads across module boundaries continue to flow through the synchronous event bus (ADR-0007) and the inbound event adapters (ADR-0007 ACL).

### Static enforcement via `@synapsestudios/eslint-plugin-data-boundaries`

The rule `no-cross-schema-slonik-access` is configured in `eslint.config.mjs` with `modulePath: "/modules/"`. For any file under `packages/server/src/modules/<name>/`, the rule requires fully-qualified table names in slonik tagged templates and forbids access to tables in any schema other than the one that module owns.

`packages/server/src/test-utils/` and `packages/jobs/src/test-utils/` are **not** scoped by the rule — they legitimately TRUNCATE across schemas to reset state between tests. The lint scope is also restricted to non-test files because integration tests sometimes seed via raw SQL into the owning module's neighbour (e.g. a `wallet` test seeding a `user.users` row through `@org/database` rather than the user repository).

### Test harness convention

`truncate(...)` in both test-utils packages requires `"schema.table"` qualified strings; mis-qualified inputs throw at runtime with an explanatory message. The test runtime drops every module schema before replaying migrations from scratch. `MODULE_SCHEMAS` (`user, todos, wallet, auth, platform, organization, billing`) is listed in both `packages/server/src/test-utils/test-database.ts` and `packages/jobs/src/test-utils/test-database.ts`; adding a module appends its schema to both (and to `packages/acceptance/test-utils/database.ts`).

## Consequences

**Positive**

- Cross-module persistence coupling is now flagged at lint time, joining imports (dep-cruise) and runtime (event bus) in the boundary-enforcement set.
- The ownership of a table is visible in every query. `wallet.wallets` cannot be confused for a shared table.
- Migration files are scoped: each file does one DDL action, easing review and history.

**Negative / trade-offs**

- Adding a table to an existing module still requires a `create_table_*.sql` and, if a FK to another module's table is needed, a migration that references the foreign schema explicitly.
- A new module requires a `create_schema_<name>.sql` migration AND appending `<name>` to `MODULE_SCHEMAS` in the test-database files (server + jobs + acceptance). This duplication is acceptable because `@org/jobs` must not depend on `@org/server`; if a fourth consumer appears, promote `test-database.ts` to a shared `@org/test-utils` package.
- Down migrations are deliberately not authored (ADR-0011).

## Alternatives considered

- **Schemas + drop cross-schema FKs entirely.** Pure logical decoupling. Rejected: a wallet without a user is a money-shaped bug; the physical safety net is cheap insurance and does not introduce coupling beyond what already existed.
- **No schemas; rely on a custom dep-cruise rule that parses SQL strings.** Rejected: parsing arbitrary tagged-template SQL is fragile and would not catch dynamic identifiers. Per-module schemas make the constraint structural.
- **Switch off Flyway to get OSS down migrations.** Rejected as out of scope; the value-per-effort of schemas + lint is much higher than down-migration tooling on a template repo.

## Related

- ADR-0002: hexagonal module layout (the boundary we're now also enforcing at the DB).
- ADR-0007: synchronous event bus + interface/events ACL (the legitimate cross-module read seam).
- ADR-0008: dependency-cruiser sibling-isolation rules (the import-layer equivalent of this rule).
- ADR-0011: forward-only Flyway migrations (the format these schema migrations use).
