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

import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { UserCreated } from "@/modules/user/index.js";
import { WalletRepository } from "@/modules/wallet/domain/ports/repositories/wallet-repository.js";
import { handleUserCreated } from "@/modules/wallet/event-handlers/create-wallet-when-user-is-created.js";
import { type UserCreatedTrigger } from "@/modules/wallet/event-handlers/triggers/user-events.js";
import { DomainEventBus } from "@/platform/ddd/domain-event-bus.js";

const toTrigger = (event: UserCreated): UserCreatedTrigger => ({ userId: event.userId });

export const UserEventAdapterLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const bus = yield* DomainEventBus;
    const repo = yield* WalletRepository;
    yield* bus.subscribe(UserCreated, (event) =>
      handleUserCreated(toTrigger(event)).pipe(
        Effect.provideService(WalletRepository, repo),
        // The bus contract (`subscribe` returns `Effect<void>`) requires
        // handlers with no typed error channel: per ADR-0007, subscriber
        // failures roll back the publisher's transaction via the defect
        // path. The handler now propagates `PersistenceUnavailable` (since
        // the wallet repo can fail transiently); `Effect.orDie` demotes
        // that to a defect so the rollback still happens, at the cost of
        // collapsing 503 into 500 for the *cross-module* failure case.
        // A direct `UserRepository` transient failure still surfaces as
        // 503 because that flows through the command's typed channel.
        Effect.orDie,
      ),
    );
  }),
);
