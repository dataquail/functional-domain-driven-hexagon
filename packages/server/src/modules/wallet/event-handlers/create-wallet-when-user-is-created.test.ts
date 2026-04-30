import { type UserCreated } from "@/modules/user/index.js";
import { UserId } from "@/modules/wallet/domain/user-id.js";
import { WalletAlreadyExistsForUser } from "@/modules/wallet/domain/wallet-errors.js";
import { WalletId } from "@/modules/wallet/domain/wallet-id.js";
import { WalletRepository } from "@/modules/wallet/domain/wallet-repository.js";
import * as Wallet from "@/modules/wallet/domain/wallet.aggregate.js";
import { WalletRepositoryFake } from "@/modules/wallet/infrastructure/wallet-repository-fake.js";
import { DomainEventBus, makeDomainEventBusLive } from "@/platform/domain-event-bus.js";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { CreateWalletWhenUserIsCreatedLive, handle } from "./create-wallet-when-user-is-created.js";

const aliceId = UserId.make("11111111-1111-1111-1111-111111111111");
const bobId = UserId.make("22222222-2222-2222-2222-222222222222");

const userCreated = (userId: UserId): UserCreated => ({
  _tag: "UserCreated",
  userId,
  email: "alice@example.com",
  address: { country: "USA", street: "123 Main St", postalCode: "12345" },
});

const seedWallet = (userId: UserId) =>
  Effect.gen(function* () {
    const repo = yield* WalletRepository;
    const id = WalletId.make("99999999-9999-9999-9999-999999999999");
    const now = yield* DateTime.now;
    const { wallet } = Wallet.create({ id, userId, now });
    yield* repo.insert(wallet);
  });

describe("createWalletWhenUserIsCreated (handle)", () => {
  it.effect("inserts a wallet with balance=0 carrying the event's userId", () =>
    Effect.gen(function* () {
      yield* handle(userCreated(aliceId));
      const repo = yield* WalletRepository;
      const stored = yield* repo.findByUserId(aliceId);
      ok(Option.isSome(stored));
      deepStrictEqual(stored.value.balance, 0);
      deepStrictEqual(stored.value.userId, aliceId);
    }).pipe(Effect.provide(WalletRepositoryFake)),
  );

  it.effect("fails WalletAlreadyExistsForUser when a wallet already exists for the userId", () =>
    Effect.gen(function* () {
      yield* seedWallet(aliceId);
      const exit = yield* Effect.exit(handle(userCreated(aliceId)));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof WalletAlreadyExistsForUser, true);
      }
    }).pipe(Effect.provide(WalletRepositoryFake)),
  );
});

// The subscriber Layer wires `handle` into the bus and adds the
// `WalletAlreadyExistsForUser` catch. These tests prove the catch is at the
// subscriber boundary (idempotency) and that non-idempotency failures
// propagate as defects (so the publisher's transaction would roll back).
describe("CreateWalletWhenUserIsCreatedLive (subscriber boundary)", () => {
  // The subscriber consumes DomainEventBus + WalletRepository at layer-build
  // time (it calls bus.subscribe). provideMerge re-exports the dependencies so
  // tests can call dispatch and inspect the repo.
  const TestLayer = CreateWalletWhenUserIsCreatedLive.pipe(
    Layer.provideMerge(WalletRepositoryFake),
    Layer.provideMerge(makeDomainEventBusLive()),
  );

  it.effect(
    "catches WalletAlreadyExistsForUser so a duplicate UserCreated dispatch is a no-op",
    () =>
      Effect.gen(function* () {
        const bus = yield* DomainEventBus;

        yield* bus.dispatch([userCreated(bobId)]);
        const exit = yield* Effect.exit(bus.dispatch([userCreated(bobId)]));
        deepStrictEqual(Exit.isSuccess(exit), true);

        const repo = yield* WalletRepository;
        const stored = yield* repo.findByUserId(bobId);
        ok(Option.isSome(stored));
      }).pipe(Effect.provide(TestLayer)),
  );

  it.effect(
    "propagates non-idempotency failures as defects (publisher transaction would roll back)",
    () =>
      Effect.gen(function* () {
        const FailingRepo = Layer.succeed(
          WalletRepository,
          WalletRepository.of({
            insert: () => Effect.die("simulated infrastructure failure"),
            findByUserId: () => Effect.succeed(Option.none()),
          }),
        );
        const FailingTestLayer = CreateWalletWhenUserIsCreatedLive.pipe(
          Layer.provideMerge(FailingRepo),
          Layer.provideMerge(makeDomainEventBusLive()),
        );

        const exit = yield* Effect.flatMap(DomainEventBus, (bus) =>
          Effect.exit(bus.dispatch([userCreated(aliceId)])),
        ).pipe(Effect.provide(FailingTestLayer));

        deepStrictEqual(Exit.isFailure(exit), true);
        if (Exit.isFailure(exit)) {
          // A defect (Die), not a typed Fail — the catchTag in the subscriber
          // does not match, so the failure propagates out of dispatch and
          // would reach the surrounding `tx.run` to trigger rollback.
          deepStrictEqual(exit.cause._tag, "Die");
        }
      }),
  );
});
