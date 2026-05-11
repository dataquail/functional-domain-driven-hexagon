import { type UserId } from "@/platform/ids/user-id.js";
import { FakeDatabaseRelaxedLive, FakeDatabaseTag } from "@/test-utils/fake-database.js";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { WalletAlreadyExistsForUser } from "../domain/wallet-errors.js";
import { WalletRepository } from "../domain/wallet-repository.js";
import { type Wallet } from "../domain/wallet.aggregate.js";

// Shared-state variant. See user-repository-fake.ts header for the
// rationale; compose under a single `FakeDatabaseLive` so cross-repo
// FK invariants exercise the same in-memory tables.
export const WalletRepositoryFakeShared: Layer.Layer<WalletRepository, never, FakeDatabaseTag> =
  Layer.effect(
    WalletRepository,
    Effect.gen(function* () {
      const db = yield* FakeDatabaseTag;

      const insert = (wallet: Wallet) =>
        db.insertWallet(wallet).pipe(
          Effect.catchTag("UniqueViolation", () =>
            Effect.fail(new WalletAlreadyExistsForUser({ userId: wallet.userId })),
          ),
          // ForeignKeyViolation from the FakeDatabase mirrors what the
          // live repository surfaces as a DatabaseError defect: the
          // event handler that owns wallet creation runs in the same
          // transaction as the user insert, so a missing user is an
          // architectural bug, not a user-facing failure. Die in
          // both fake and live.
          Effect.catchTag("ForeignKeyViolation", (e) => Effect.die(e)),
        );

      const findByUserId = (userId: UserId) => {
        for (const wallet of db.wallets.values()) {
          if (wallet.userId === userId) return Effect.succeed(Option.some(wallet));
        }
        return Effect.succeed(Option.none<Wallet>());
      };

      return WalletRepository.of({ insert, findByUserId });
    }),
  );

export const WalletRepositoryFake = WalletRepositoryFakeShared.pipe(
  Layer.provide(FakeDatabaseRelaxedLive),
);
