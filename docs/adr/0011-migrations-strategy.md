# ADR-0011: Migrations — forward-only Flyway-style SQL

- Status: Accepted
- Date: 2026-04-24

## Context and Problem Statement

Schema migrations have to be reviewable, deterministic in tests, and honest about how rollback actually works in production.

The forces:

- A migration's effect on the database should be visible in the diff. Generated SQL hidden behind ORM abstractions has historically been a source of "I didn't realize that migration would do that" production incidents.
- Tests need a deterministic schema each run. Flakiness from leftover state across runs is demoralizing.
- Production rollback is rarely "run the down migration and pretend nothing happened." Real production rollback is a forward operation: write a new migration that undoes the harm, deploy, observe. Symmetric up/down pairs encode a fiction about how production actually works.
- Concurrent feature branches will sometimes both add a migration. Ordering ambiguity must surface as a merge conflict, not silently resolve in either direction.

## Decision

- Migrations are **forward-only `.sql` files** named `V<n>__<description>.sql` (Flyway naming, `<n>` a zero-padded monotonically increasing integer, e.g. `V001__`, `V002__`). Each file does **one DDL action** — one `CREATE SCHEMA`, one `CREATE TABLE`, one `ALTER` — which eases review and history (ADR-0021).
- No down (`U__`) migrations. Flyway OSS does not apply them, and on a template repo the convention is to wipe and replay rather than incrementally roll back. To reverse a migration in any environment, write a new forward migration that undoes it.
- Production runtime applies migrations at deploy time. The exact mechanism — startup hook vs. out-of-band command — is deferred and revisited when production deployment is in scope.
- The test runtime drops every module schema and replays all migration files in numeric order on demand. There is no checksum/history machinery in the test runner — that matters for production drift, not for ephemeral test databases.

### Layout

Migrations and the database service that consumes them live together in a dedicated package (no application logic — only connection setup, migration files, and shared row schemas):

```
packages/database/
  migrations/
    V001__create_schema_user.sql
    V002__create_schema_wallet.sql
    V003__...
  src/
    Database.ts        — connection, transaction, makeQuery, TransactionContext
    or-fail.ts         — Option<T> | T helper for repository compose patterns
    row-schemas/       — typed row schemas shared by infrastructure repositories
```

Each module owns a Postgres schema named after its folder; migrations create those schemas and their tables, ordered so every `CREATE SCHEMA` lands before any `CREATE TABLE` that targets it, and any cross-schema FK is numbered after the table it references (ADR-0021).

### Test replay semantics

The test infrastructure runs the equivalent of:

```ts
for (const schema of MODULE_SCHEMAS) await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE;`);
const sqlFiles = (await fs.readdir(...)).filter(/^V\d+__.*\.sql$/).sort(numericPrefix);
for (const file of sqlFiles) await pool.query(await fs.readFile(...));
```

Memoized so concurrent test files that each call `runMigrations` in `beforeAll` don't race. The destructive drop is gated by the test-database name guard (ADR-0009).

## Consequences

- Every schema change is explicit SQL, reviewable as plain text in the PR. No surprises from a generator inferring an intent that wasn't yours.
- Test runs are fully reproducible: each run starts from empty module schemas. No truncate-and-reseed rituals; no "passes locally, fails in CI" rooted in residual state.
- Migration ordering is by filename numeric prefix. Two branches that both add a migration with the next number must rebase one onto the other before merge — a feature, not a defect: it forces an explicit decision about ordering.
- No automated rollback. A botched production migration is rolled forward, not backward. This pushes useful discipline into migration design: separate a column drop from the code that stops reading it; do additive changes first, destructive changes after read traffic stops; deploy in stages so a partial rollback is itself a forward migration plus a code revert.
- No history table today. The file naming convention and forward-only discipline are compatible with adding one later without rewriting existing migrations.

## Alternatives considered

- **ORM-driven auto-migrations.** Rejected — generated SQL is too easy to push without inspection. The whole reason for plain SQL files is so the diff is the migration.
- **Reversible up/down migrations.** Rejected. A "down" migration to drop a column doesn't restore the data "up" put there; the discipline of writing symmetric pairs encourages overconfidence in production reversibility.
- **TypeScript migration scripts.** Rejected. Migration logic should be expressible in SQL. Imperative data backfills live in a one-off command outside the migration runner — schema and backfills are different concerns.
- **Per-environment seed scripts as part of migration.** Rejected — seeds are environment data, not schema. Conflating them complicates promotion of the same migration file across environments.

## Related

- ADR-0005 (repository pattern) — uses the database service that the migrations target.
- ADR-0009 (testing pyramid) — the test database safety guard works in concert with the destructive replay semantics.
- ADR-0020 (per-module database schemas) — the schema-per-module boundary these migrations create and the one-DDL-per-file convention.
