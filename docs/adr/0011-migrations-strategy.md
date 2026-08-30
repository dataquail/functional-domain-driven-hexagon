# ADR-0011: Migrations — forward-only TypeScript modules

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

- Migrations are **forward-only TypeScript modules** in `packages/database/src/migrations/`, named `<nnnn>_<description>.ts` (`<nnnn>` a zero-padded monotonically increasing integer, e.g. `0001_`, `0002_`). Each default-exports an `Effect` that takes `SqlClient` from context and issues one tagged-template statement per DDL action. Each file does **one logical DDL change** — one `CREATE SCHEMA`, one `CREATE TABLE` plus its indexes, one `ALTER` group — which eases review and history (ADR-0021).
- No down (`U__`) migrations. On a template repo the convention is to wipe and replay rather than incrementally roll back. To reverse a migration in any environment, write a new forward migration that undoes it.
- The runner is `@effect/sql`'s `Migrator` — a TypeScript module default-exporting an Effect is the format it was built for. `pnpm db:migrate` applies pending files; `--test` targets the test database.
- The loader is `Migrator.fromRecord`, fed by a hand-maintained `src/migrations/index.ts`. The library's `fromFileSystem` loader would discover files on disk, but its dynamic import is marked `@vite-ignore`, so under vitest it bypasses the transform and Node cannot load a `.ts` migration. A static record is the one mechanism that works for the CLI, both test suites and acceptance alike; a test asserts the record matches the directory, so a file nobody registered fails rather than silently never running.
- **Sequential integers, not timestamps.** The `Migrator` records a high-water mark and skips any id at or below it, so a lower-numbered migration merged after a higher one would never run. Sequential numbering turns that into a merge conflict instead — the same forcing function the original decision valued. It also keeps ids inside the library's `migration_id integer` column, which a `YYYYMMDDHHMMSS` id overflows.
- Production runtime applies migrations at deploy time. The exact mechanism — startup hook vs. out-of-band command — is deferred and revisited when production deployment is in scope.
- The test runtime drops every module schema **and the migration history table**, then replays every file. Test databases want a deterministic schema, not drift detection, so the history is discarded rather than reconciled.

### Layout

Migrations and the database service that consumes them live together in a dedicated package (no application logic — only connection setup, migration files, and shared row schemas):

```
packages/database/src/
  Database.ts          — the client Tag, row decoding, the error vocabulary
  pg-driver.ts         — the only file naming the driver
  migrator.ts          — the loader, the runner, the test replay, MODULE_SCHEMAS
  migrations/
    index.ts           — the registry fromRecord consumes
    0001_create_schema_user.ts
    0002_create_schema_organization.ts
    ...
  or-fail.ts           — Option<T> | T helper for repository compose patterns
  row-schemas/         — typed row schemas shared by infrastructure repositories
```

Migrations sit under `src/` so `tsc` typechecks them and they compile alongside
everything else — a migration with a syntax error fails the build, not the deploy.

A migration reads:

```ts
// src/migrations/0001_create_schema_user.ts
export default Effect.gen(function* () {
  const sql = yield* SqlClient;

  yield* sql`CREATE SCHEMA "user"`;
});
```

Each module owns a Postgres schema named after its folder; migrations create those schemas and their tables, ordered so every `CREATE SCHEMA` lands before any `CREATE TABLE` that targets it, and any cross-schema FK is numbered after the table it references (ADR-0021).

### Test replay semantics

`resetAndMigrate` drops every module schema plus `effect_sql_migrations`, then runs the migrator. The server, jobs and acceptance harnesses all call it — one implementation, so every entry point agrees on one history table and a replay leaves a database that `db:migrate` correctly reports as up to date.

Memoized so concurrent test files that each call `runMigrations` in `beforeAll` don't race. The destructive drop is gated by the test-database name guard (ADR-0009).

## Consequences

- Every schema change is explicit SQL, reviewable as plain text in the PR. No surprises from a generator inferring an intent that wasn't yours.
- Test runs are fully reproducible: each run starts from empty module schemas. No truncate-and-reseed rituals; no "passes locally, fails in CI" rooted in residual state.
- Migration ordering is by filename numeric prefix. Two branches that both add a migration with the next number must rebase one onto the other before merge — a feature, not a defect: it forces an explicit decision about ordering.
- No automated rollback. A botched production migration is rolled forward, not backward. This pushes useful discipline into migration design: separate a column drop from the code that stops reading it; do additive changes first, destructive changes after read traffic stops; deploy in stages so a partial rollback is itself a forward migration plus a code revert.
- The runner records what it has applied in an `effect_sql_migrations` table, so a repeat run against a live database is a no-op and only pending files execute. A database whose schema predates that table has to be replayed once (`db:reset` then `db:migrate`); there is no baselining path, which is acceptable because no environment here holds data worth preserving.

## Alternatives considered

- **ORM-driven auto-migrations.** Rejected — generated SQL is too easy to push without inspection. The whole reason for plain SQL files is so the diff is the migration.
- **Reversible up/down migrations.** Still rejected, and now also unavailable: `Migrator` has no notion of `down`, and never has — `down`/`rollback`/`revert` appear nowhere in it, going back to its origin in `sqlfx` (2023), whose README stated "migrations are forward-only" as a design premise. Adopting `down` would mean replacing the runner. The original argument stands on its own: a "down" migration to drop a column doesn't restore the data "up" put there, and writing symmetric pairs encourages overconfidence in production reversibility.
- **Plain `.sql` files.** The original decision (2026-04-24), on the grounds that migration logic should be expressible in SQL and that backfills belong in a one-off command outside the runner. Reversed: the SQL stays just as visible inside a tagged template, while a module can also loop, branch, or call a domain function when a schema change needs data moved with it. Forcing that into a separate command meant the backfill was neither ordered against the schema change nor recorded as applied. `.sql` files were also the format the `Migrator` was _not_ built for — a TypeScript module exporting an Effect is its native shape, and honouring the old decision cost a custom loader.
- **Per-environment seed scripts as part of migration.** Rejected — seeds are environment data, not schema. Conflating them complicates promotion of the same migration file across environments.

## Related

- ADR-0005 (repository pattern) — uses the database service that the migrations target.
- ADR-0009 (testing pyramid) — the test database safety guard works in concert with the destructive replay semantics.
- ADR-0020 (per-module database schemas) — the schema-per-module boundary these migrations create and the one-DDL-per-file convention.
