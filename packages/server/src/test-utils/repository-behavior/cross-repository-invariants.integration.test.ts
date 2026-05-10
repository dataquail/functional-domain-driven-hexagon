// Runs the cross-repository invariants contract suite against:
//
//   1. `FakeRepositoriesLive` — always. Proves the FakeDatabase's
//      enforcement of unique indexes, FK existence, and cascade
//      delete matches the schema's documented behavior.
//
//   2. A live composition over Postgres — gated on
//      `DATABASE_URL_TEST`. Proves the schema actually behaves the
//      way the fake's contract claims. If these two diverge, either
//      the schema regressed or the fake is lying.
//
// File naming: `.integration.test.ts` because the live tier runs SQL.
// On a no-DB machine, vitest will still run the fake suite — the
// describe block guarded by `hasTestDatabase` simply skips.

import { AuthIdentityRepositoryFakeShared } from "@/modules/auth/infrastructure/auth-identity-repository-fake.js";
import { SessionRepositoryFakeShared } from "@/modules/auth/infrastructure/session-repository-fake.js";
import { SessionRepositoryLive } from "@/modules/auth/infrastructure/session-repository-live.js";
import { TodosRepositoryFakeShared } from "@/modules/todos/infrastructure/todos-repository-fake.js";
import { TodosRepositoryLive } from "@/modules/todos/infrastructure/todos-repository-live.js";
import { UserRepositoryFakeShared } from "@/modules/user/infrastructure/user-repository-fake.js";
import { UserRepositoryLive } from "@/modules/user/infrastructure/user-repository-live.js";
import { WalletRepositoryFakeShared } from "@/modules/wallet/infrastructure/wallet-repository-fake.js";
import { WalletRepositoryLive } from "@/modules/wallet/infrastructure/wallet-repository-live.js";
import { type UserId } from "@/platform/ids/user-id.js";
import { FakeDatabase, FakeDatabaseTag } from "@/test-utils/fake-database.js";
import { hasTestDatabase, TestDatabaseLive, truncate } from "@/test-utils/test-database.js";
import { Database, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { crossRepositoryInvariantsSuite } from "./cross-repository-invariants.contract.js";

// ─── Fake wiring ──────────────────────────────────────────────────
// A single FakeDatabase instance shared by every repo in the suite,
// captured here so the `reset` and `inspect` effects can mutate /
// read the same Maps the repositories see.
const fakeDatabaseInstance = new FakeDatabase();
const FakeDatabaseFixedLive = Layer.succeed(FakeDatabaseTag, fakeDatabaseInstance);

const FakeRepositoriesShared = Layer.mergeAll(
  UserRepositoryFakeShared,
  WalletRepositoryFakeShared,
  TodosRepositoryFakeShared,
  SessionRepositoryFakeShared,
  AuthIdentityRepositoryFakeShared,
);

const FakeLayer = FakeRepositoriesShared.pipe(Layer.provide(FakeDatabaseFixedLive));

const fakeReset = Effect.sync(() => {
  fakeDatabaseInstance.users.clear();
  fakeDatabaseInstance.wallets.clear();
  fakeDatabaseInstance.todos.clear();
  fakeDatabaseInstance.sessions.clear();
  fakeDatabaseInstance.authIdentities.clear();
});

const fakeInspectWalletCountForUser = (userId: UserId) =>
  Effect.sync(() => {
    let count = 0;
    for (const wallet of fakeDatabaseInstance.wallets.values()) {
      if (wallet.userId === userId) count += 1;
    }
    return count;
  });

crossRepositoryInvariantsSuite({
  name: "FakeDatabase",
  layer: FakeLayer,
  reset: fakeReset,
  inspectWalletCountForUser: fakeInspectWalletCountForUser,
});

// ─── Live wiring ──────────────────────────────────────────────────
// Skipped without DATABASE_URL_TEST. Schema invariants are exercised
// against real Postgres so the fake's claims about UNIQUE / FK /
// CASCADE behavior can't silently drift from the migrations.
if (hasTestDatabase) {
  const LiveRepoLayer = Layer.mergeAll(
    UserRepositoryLive,
    WalletRepositoryLive,
    TodosRepositoryLive,
    SessionRepositoryLive,
  );
  // A DB connection failure is an environment defect, not a typed
  // contract failure; orDie keeps the contract type (`Layer<..., never>`)
  // satisfied while preserving the original cause in the defect.
  const LiveLayer = LiveRepoLayer.pipe(Layer.provideMerge(TestDatabaseLive), Layer.orDie);

  const liveReset = truncate("wallets", "sessions", "auth_identities", "users", "todos");

  const CountStd = Schema.standardSchemaV1(Schema.Struct({ value: Schema.Number }));
  const liveInspectWalletCountForUser = (userId: UserId) =>
    Effect.gen(function* () {
      const db = yield* Database.Database;
      const row = yield* db
        .execute((c) =>
          c.one(sql.type(CountStd)`
            SELECT COUNT(*)::int AS value FROM wallets WHERE user_id = ${userId}
          `),
        )
        .pipe(Effect.orDie);
      return row.value;
    }).pipe(Effect.provide(TestDatabaseLive), Effect.orDie);

  crossRepositoryInvariantsSuite({
    name: "LiveDatabase",
    layer: LiveLayer,
    reset: liveReset.pipe(Effect.provide(TestDatabaseLive), Effect.orDie),
    inspectWalletCountForUser: liveInspectWalletCountForUser,
  });
}
