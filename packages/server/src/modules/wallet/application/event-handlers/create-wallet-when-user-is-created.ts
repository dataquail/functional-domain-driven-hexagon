import { UserCreated } from "@/modules/user/index.js";
import { WalletId } from "@/modules/wallet/domain/wallet-id.js";
import { WalletRepository } from "@/modules/wallet/domain/wallet-repository.js";
import * as Wallet from "@/modules/wallet/domain/wallet.js";
import { DomainEventBus } from "@/platform/domain-event-bus.js";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

export const handle = (event: UserCreated) =>
  Effect.gen(function* () {
    const repo = yield* WalletRepository;
    const id = WalletId.make(yield* Effect.sync(() => crypto.randomUUID()));
    const now = yield* DateTime.now;
    const { wallet } = Wallet.create({ id, userId: event.userId, now });
    yield* repo.insert(wallet);
  }).pipe(
    Effect.catchTag("WalletAlreadyExistsForUser", () => Effect.void),
    Effect.withSpan("createWalletWhenUserIsCreated"),
  );

export const CreateWalletWhenUserIsCreatedLive = Effect.gen(function* () {
  const bus = yield* DomainEventBus;
  const repo = yield* WalletRepository;
  yield* bus.subscribe(UserCreated, (event) =>
    handle(event).pipe(
      Effect.provideService(WalletRepository, repo),
      Effect.catchAllCause(Effect.logError),
    ),
  );
});
