// Anti-corruption layer between `user`'s published events and the
// wallet module's internal trigger types. The ONLY file in
// `wallet/event-handlers/` allowed to import from
// `@/modules/user/index.js` — enforced by the
// `event-handlers-cross-module-via-adapter-only` dep-cruiser rule.
//
// Each subscriber here translates a publisher's event into the
// wallet-internal shape declared in `./triggers/`, then forwards to a
// handler that depends only on the trigger type. If `user` adds
// fields to `UserCreated`, only this file changes — the handlers and
// trigger types stay stable.

import { UserCreated } from "@/modules/user/index.js";
import { WalletRepository } from "@/modules/wallet/domain/wallet-repository.js";
import { DomainEventBus } from "@/platform/domain-event-bus.js";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { handleUserCreated } from "./create-wallet-when-user-is-created.js";
import { type UserCreatedTrigger } from "./triggers/user-events.js";

const toTrigger = (event: UserCreated): UserCreatedTrigger => ({ userId: event.userId });

export const UserEventAdapterLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const bus = yield* DomainEventBus;
    const repo = yield* WalletRepository;
    yield* bus.subscribe(UserCreated, (event) =>
      handleUserCreated(toTrigger(event)).pipe(Effect.provideService(WalletRepository, repo)),
    );
  }),
);
