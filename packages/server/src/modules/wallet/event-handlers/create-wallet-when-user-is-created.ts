// Wallet's reaction to a "user was created" trigger. Imports the
// wallet-internal `UserCreatedTrigger` from ./triggers/ — NOT
// `UserCreated` from `@/modules/user/index.js`. The translation
// happens in ./user-event-adapter.ts, which is the only file allowed
// to cross the boundary.
//
// Runs synchronously inside the publisher's transaction (ADR-0007),
// so an unexpected failure rolls back the originating user-creation.
// The `WalletAlreadyExistsForUser` catch is a defensive idempotency
// net for a case that shouldn't occur given a freshly-minted user id;
// any other error propagates as a defect.

import { WalletId } from "@/modules/wallet/domain/wallet-id.js";
import { WalletRepository } from "@/modules/wallet/domain/wallet-repository.js";
import * as Wallet from "@/modules/wallet/domain/wallet.aggregate.js";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { type UserCreatedTrigger } from "./triggers/user-events.js";

export const handleUserCreated = (trigger: UserCreatedTrigger) =>
  Effect.gen(function* () {
    const repo = yield* WalletRepository;
    const id = WalletId.make(yield* Effect.sync(() => crypto.randomUUID()));
    const now = yield* DateTime.now;
    const { wallet } = Wallet.create({ id, userId: trigger.userId, now });
    yield* repo
      .insert(wallet)
      .pipe(Effect.catchTag("WalletAlreadyExistsForUser", () => Effect.void));
  });
