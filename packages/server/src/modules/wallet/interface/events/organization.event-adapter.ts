// Inbound event adapter (ADR-0007): the only file in the wallet module
// permitted to import `@/modules/organization/index.js`. It translates
// `OrganizationCreated` into a `CreateWalletCommand` and dispatches it
// through the bus — a bus-only inbound port, structurally identical to an
// HTTP endpoint. It never touches the wallet domain, its ops, or its
// repository: the CreateWallet command handler owns the mutation (the
// ADR-0022 mutation boundary). If organization adds a field to the event,
// only this translation changes.

import { CommandBus } from "@org/cqrs";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { OrganizationCreated } from "@/modules/organization/index.js";
import { CreateWallet } from "@/modules/wallet/commands/create-wallet.command.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";

export const OrganizationEventAdapterLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const domainEventBus = yield* DomainEventBus;
    const commandBus = yield* CommandBus;
    yield* domainEventBus.subscribe(OrganizationCreated, (event) =>
      // `orDie` demotes a transient failure to a defect so it rolls the
      // publisher back — collapsing 503 → 500 for this cross-module path, which
      // is the immediate-consistency contract.
      commandBus.execute(CreateWallet, { organizationId: event.organizationId }).pipe(Effect.orDie),
    );
  }),
);
