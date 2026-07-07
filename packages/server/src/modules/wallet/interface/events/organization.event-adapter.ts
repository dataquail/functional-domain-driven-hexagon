// Anti-corruption layer between `organization`'s published events and
// the wallet module's internal trigger types. Inbound port — lives in
// `interface/events/` alongside HTTP endpoints (`interface/http/`)
// since both are inbound transports translating external schemas into
// internal messages. Only this file is permitted to import from
// `@/modules/organization/index.js`; the use case downstream consumes
// the trigger type and stays decoupled from the publisher's event shape
// (ADR-0007).
//
// If `organization` adds fields to `OrganizationCreated`, only this
// file changes — the handler and trigger types stay stable.

import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { OrganizationCreated } from "@/modules/organization/index.js";
import { WalletRepository } from "@/modules/wallet/domain/ports/repositories/wallet.repository.js";
import { handleOrganizationCreated } from "@/modules/wallet/event-handlers/create-wallet-when-organization-is-created.handler.js";
import { type OrganizationCreatedTrigger } from "@/modules/wallet/event-handlers/triggers/organization.triggers.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";

const toTrigger = (event: OrganizationCreated): OrganizationCreatedTrigger => ({
  organizationId: event.organizationId,
});

export const OrganizationEventAdapterLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const bus = yield* DomainEventBus;
    const repo = yield* WalletRepository;
    yield* bus.subscribe(OrganizationCreated, (event) =>
      handleOrganizationCreated(toTrigger(event)).pipe(
        Effect.provideService(WalletRepository, repo),
        // The bus contract (`subscribe` returns `Effect<void>`) requires
        // handlers with no typed error channel: per ADR-0007, subscriber
        // failures roll back the publisher's transaction via the defect
        // path. The handler now propagates `PersistenceUnavailable` (since
        // the wallet repo can fail transiently); `Effect.orDie` demotes
        // that to a defect so the rollback still happens, at the cost of
        // collapsing 503 into 500 for the *cross-module* failure case.
        // A direct `OrganizationRepository` transient failure still
        // surfaces as 503 because that flows through the command's typed
        // channel.
        Effect.orDie,
      ),
    );
  }),
);
