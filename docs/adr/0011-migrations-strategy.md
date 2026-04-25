# ADR-0011: Migrations — forward-only Flyway-style SQL

- Status: Accepted
- Date: 2026-04-24

## Context and Problem Statement

Schema migrations have to be reviewable, deterministic in tests, and honest about how rollback actually works in production.

The forces:

- A migration's effect on the database should be visible in the diff. Generated SQL hidden behind ORM abstractions has historically been a source of "I didn't realize that migration would do that" production incidents.
- Tests need a deterministic schema each run. Flakiness from leftover state across runs is one of the more demoralizing categories of test instability.
- Production rollback is rarely "run the down migration and pretend nothing happened." Real production rollback is a forward operation: write a new migration that undoes the harm, deploy, observe. Designing the migration system around symmetric up/down pairs encodes a fiction about how production actually works.
- Concurrent feature branches will sometimes both add a migration. Ordering ambiguity must surface as a merge conflict, not silently resolve in either direction.

## Decision

- Migrations are **forward-only `.sql` files** named `V<n>__<description>.sql` (Flyway naming convention, where `<n>` is a monotonically increasing integer).
- No down migrations. To reverse a migration in any environment, write a new forward migration that undoes it.
- Production runtime applies migrations at deploy time. The exact mechanism — startup hook vs. out-of-band command — is currently deferred and will be revisited when production deployment is in scope.
- The test runtime drops the public schema and replays all migration files in numeric order on demand. There is no checksum/history machinery in the test runner — that matters for production drift, not for ephemeral test databases.

### Layout

Migrations and the database service that consumes them live together in a dedicated package (no application logic in that package — only connection setup, migration files, and shared row schemas):

```
database/
  migrations/
    V1__initial.sql
    V2__wallets.sql
    V3__...
  src/
    Database.ts        — connection, transaction, makeQuery, TransactionContext
    or-fail.ts         — Option<T> | T helper for repository compose patterns
    row-schemas/       — typed row schemas shared by infrastructure repositories
```

### Test replay semantics

The test infrastructure runs the equivalent of:

```ts
await pool.query(`DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;`);
const sqlFiles = (await fs.readdir(...)).filter(/^V\d+__.*\.sql$/).sort(numericPrefix);
for (const file of sqlFiles) await pool.query(await fs.readFile(...));
```

Memoized so concurrent test files that each call `runMigrations` in `beforeAll` don't race.

## Consequences

- Every schema change is explicit SQL, reviewable as plain text in the PR. No surprises from a generator inferring an intent that wasn't yours.
- Test runs are fully reproducible: each run starts from an empty schema. No truncate-and-reseed rituals; no "this test passes locally but fails in CI" rooted in residual state.
- Migration ordering is by filename numeric prefix. Two feature branches that both add a migration with the next number must rebase one onto the other before merge. This is a feature, not a defect: it forces an explicit decision about ordering.
- No automated rollback. A botched production migration is rolled forward, not backward. This pushes a useful discipline into the migration design itself: separate a column drop from the code that stops reading it; do additive changes first, destructive changes after the read traffic has stopped; deploy in stages so that a partial rollback is itself a forward migration plus a code revert.
- No history table today. We can add one later if production drift becomes a concern; the file naming convention and forward-only discipline are compatible with adding it without rewriting existing migrations.

## Alternatives considered

- **ORM-driven auto-migrations.** Rejected — generated SQL is too easy to push without inspection. The whole reason for plain SQL files is so the diff is the migration.
- **Reversible up/down migrations.** Rejected. Down migrations are a fiction in any environment with non-trivial data: a "down" migration to drop a column doesn't restore the data that was in it before "up" added it. The discipline of writing a down migration that pretends rollback is symmetric encourages overconfidence in production reversibility.
- **TypeScript migration scripts.** Rejected. Migration logic should be expressible in SQL. If imperative migration of data is needed (e.g. a backfill that requires application logic), it can live in a one-off command outside the migration runner — versioning of schema and one-off backfills are different concerns.
- **Per-environment seed scripts as part of migration**. Rejected — seeds are environment data, not schema. Conflating them complicates promotion of the same migration file across environments. Seeds, when they exist, are a separate concern and a separate runner.

## Related

- ADR-0005 (repository pattern) — uses the database service that the migrations target.
- ADR-0009 (testing pyramid) — the test database safety guard works in concert with the destructive replay semantics.
