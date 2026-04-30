import { WalletAlreadyExistsForUser } from "@/modules/wallet/domain/wallet-errors.js";
import { WalletId } from "@/modules/wallet/domain/wallet-id.js";
import { WalletRepository } from "@/modules/wallet/domain/wallet-repository.js";
import * as Wallet from "@/modules/wallet/domain/wallet.aggregate.js";
import { WalletRepositoryLive } from "@/modules/wallet/infrastructure/wallet-repository-live.js";
import { UserId } from "@/platform/ids/user-id.js";
import { hasTestDatabase, TestDatabaseLive, truncate } from "@/test-utils/test-database.js";
import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { beforeEach } from "vitest";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const otherUserId = UserId.make("22222222-2222-2222-2222-222222222222");
const walletId = WalletId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const otherWalletId = WalletId.make("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
const now = DateTime.unsafeMake(new Date("2025-01-01T00:00:00Z"));

const aliceWallet = Wallet.create({ id: walletId, userId, now }).wallet;

// FK precondition only. The user row exists solely to satisfy
// `wallets_user_id_users_id_fk`; it is not the subject of these tests. Going
// through the user module's HTTP layer to seed it would also fire the
// `CreateWalletWhenUserIsCreated` event handler and create a wallet as a
// side effect, defeating the test setup. Direct SQL is the smallest, most
// honest seam for a cross-module FK precondition.
const seedUserRow = (id: UserId) =>
  Effect.gen(function* () {
    const db = yield* Database.Database;
    yield* db
      .execute((c) =>
        c.query(sql.unsafe`
          INSERT INTO users (id, email, role, country, street, postal_code, created_at, updated_at)
          VALUES (${id}, ${id + "@example.com"}, 'guest', 'USA', '123 Main', '12345', NOW(), NOW())
        `),
      )
      .pipe(Effect.orDie);
  });

const TestLayer = WalletRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

const suite = hasTestDatabase ? describe.sequential : describe.skip;

suite("WalletRepositoryLive (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(truncate("wallets", "users").pipe(Effect.provide(TestDatabaseLive)));
  });

  describe("insert", () => {
    it.effect("persists the wallet and decodes it back via findByUserId", () =>
      Effect.gen(function* () {
        yield* seedUserRow(userId);
        const repo = yield* WalletRepository;
        yield* repo.insert(aliceWallet);
        const found = yield* repo.findByUserId(userId);
        deepStrictEqual(Option.isSome(found), true);
        if (Option.isSome(found)) {
          deepStrictEqual(found.value.id, aliceWallet.id);
          deepStrictEqual(found.value.userId, userId);
          deepStrictEqual(found.value.balance, 0);
        }
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect(
      "fails WalletAlreadyExistsForUser on duplicate user_id (unique violation → domain error)",
      () =>
        Effect.gen(function* () {
          yield* seedUserRow(userId);
          const repo = yield* WalletRepository;
          yield* repo.insert(aliceWallet);
          const clashing = Wallet.create({ id: otherWalletId, userId, now }).wallet;
          const exit = yield* Effect.exit(repo.insert(clashing));
          deepStrictEqual(Exit.isFailure(exit), true);
          if (Exit.isFailure(exit)) {
            const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
            deepStrictEqual(error instanceof WalletAlreadyExistsForUser, true);
            deepStrictEqual((error as WalletAlreadyExistsForUser).userId, userId);
          }
        }).pipe(Effect.provide(TestLayer)),
    );
  });

  describe("findByUserId", () => {
    it.effect("returns None when no wallet exists for the user", () =>
      Effect.gen(function* () {
        const repo = yield* WalletRepository;
        const result = yield* repo.findByUserId(otherUserId);
        deepStrictEqual(Option.isNone(result), true);
      }).pipe(Effect.provide(TestLayer)),
    );
  });
});
