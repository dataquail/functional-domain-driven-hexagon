import { WalletId } from "@/modules/wallet/domain/wallet-id.js";
import { WalletRepository } from "@/modules/wallet/domain/wallet-repository.js";
import * as Wallet from "@/modules/wallet/domain/wallet.aggregate.js";
import { WalletRepositoryFake } from "@/modules/wallet/infrastructure/wallet-repository-fake.js";
import { UserId } from "@/platform/ids/user-id.js";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import { handleUserCreated } from "./create-wallet-when-user-is-created.js";
import { type UserCreatedTrigger } from "./triggers/user-events.js";

const aliceId = UserId.make("11111111-1111-1111-1111-111111111111");

const trigger = (userId: UserId): UserCreatedTrigger => ({ userId });

const seedWallet = (userId: UserId) =>
  Effect.gen(function* () {
    const repo = yield* WalletRepository;
    const id = WalletId.make("99999999-9999-9999-9999-999999999999");
    const now = yield* DateTime.now;
    const { wallet } = Wallet.create({ id, userId, now });
    yield* repo.insert(wallet);
  });

describe("createWalletWhenUserIsCreated (handleUserCreated)", () => {
  it.effect("inserts a wallet with balance=0 carrying the trigger's userId", () =>
    Effect.gen(function* () {
      yield* handleUserCreated(trigger(aliceId));
      const repo = yield* WalletRepository;
      const stored = yield* repo.findByUserId(aliceId);
      ok(Option.isSome(stored));
      deepStrictEqual(stored.value.balance, 0);
      deepStrictEqual(stored.value.userId, aliceId);
    }).pipe(Effect.provide(WalletRepositoryFake)),
  );

  it.effect(
    "swallows WalletAlreadyExistsForUser so a duplicate trigger is a no-op (idempotent at the handler boundary)",
    () =>
      Effect.gen(function* () {
        yield* seedWallet(aliceId);
        const exit = yield* Effect.exit(handleUserCreated(trigger(aliceId)));
        deepStrictEqual(Exit.isSuccess(exit), true);
      }).pipe(Effect.provide(WalletRepositoryFake)),
  );

  it.effect(
    "propagates non-idempotency failures as defects (publisher transaction would roll back)",
    () =>
      Effect.gen(function* () {
        const FailingRepo = Effect.provideService(WalletRepository, {
          insert: () => Effect.die("simulated infrastructure failure"),
          findByUserId: () => Effect.succeed(Option.none()),
        });
        const exit = yield* Effect.exit(handleUserCreated(trigger(aliceId)).pipe(FailingRepo));
        deepStrictEqual(Exit.isFailure(exit), true);
        if (Exit.isFailure(exit)) {
          // A defect (Die), not a typed Fail — the catchTag in the handler
          // does not match, so the failure propagates out and would reach
          // the surrounding `tx.run` to trigger rollback.
          deepStrictEqual(exit.cause._tag, "Die");
        }
      }),
  );
});
