import { UserCreated } from "@/modules/user/index.js";
import { WalletId } from "@/modules/wallet/domain/wallet-id.js";
import { WalletRepository } from "@/modules/wallet/domain/wallet-repository.js";
import * as Wallet from "@/modules/wallet/domain/wallet.js";
import { DomainEventBus } from "@/platform/domain-event-bus.js";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

export const handle = (event: UserCreated) =>
  Effect.gen(function* () {
    const repo = yield* WalletRepository;
    const id = WalletId.make(yield* Effect.sync(() => crypto.randomUUID()));
    const now = yield* DateTime.now;
    const { wallet } = Wallet.create({ id, userId: event.userId, now });
    yield* repo.insert(wallet);
  });

// The handler runs synchronously inside the publisher's transaction, so an
// unexpected failure rolls back the originating user-creation. The
// `WalletAlreadyExistsForUser` catch is a defensive idempotency net for a
// case that shouldn't occur given a freshly-minted user id; any other
// error is a real inconsistency and is allowed to propagate as a defect.
export const CreateWalletWhenUserIsCreatedLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const bus = yield* DomainEventBus;
    const repo = yield* WalletRepository;
    yield* bus.subscribe(UserCreated, (event) =>
      handle(event).pipe(
        Effect.catchTag("WalletAlreadyExistsForUser", () => Effect.void),
        Effect.provideService(WalletRepository, repo),
      ),
    );
  }),
);
