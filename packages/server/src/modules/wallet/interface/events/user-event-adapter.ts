// Anti-corruption layer between `user`'s published events and the
// wallet module's internal trigger types. Inbound port — lives in
// `interface/events/` alongside HTTP endpoints (`interface/http/`)
// since both are inbound transports translating external schemas into
// internal messages. Only this file is permitted to import from
// `@/modules/user/index.js`; the use case downstream consumes the
// trigger type and stays decoupled from the publisher's event shape
// (ADR-0007).
//
// If `user` adds fields to `UserCreated`, only this file changes —
// the handler and trigger types stay stable.

import { UserCreated } from "@/modules/user/index.js";
import { WalletRepository } from "@/modules/wallet/domain/wallet-repository.js";
import { handleUserCreated } from "@/modules/wallet/event-handlers/create-wallet-when-user-is-created.js";
import { type UserCreatedTrigger } from "@/modules/wallet/event-handlers/triggers/user-events.js";
import { DomainEventBus } from "@/platform/domain-event-bus.js";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

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
