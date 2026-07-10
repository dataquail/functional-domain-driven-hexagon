// Inbound event adapter (ADR-0007): the only file in the wallet module
// permitted to import `@/modules/organization/index.js`. It translates
// `OrganizationCreated` into a `CreateWalletCommand` and dispatches it
// through the bus — a bus-only inbound port, structurally identical to an
// HTTP endpoint. It never touches the wallet domain, its ops, or its
// repository: the CreateWallet command handler owns the mutation (the
// ADR-0022 mutation boundary). If organization adds a field to the event,
// only this translation changes.

import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { OrganizationCreated } from "@/modules/organization/index.js";
import { CreateWalletCommand } from "@/modules/wallet/commands/create-wallet.command.js";
import { CommandBus } from "@/platform/ddd/ports/command-bus.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";

export const OrganizationEventAdapterLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const domainEventBus = yield* DomainEventBus;
    const commandBus = yield* CommandBus;
    const unitOfWork = yield* UnitOfWork;
    yield* domainEventBus.subscribe(
      OrganizationCreated,
      (event) =>
        // `subscribe` requires a handler with no requirements and no error
        // channel. The dispatched command's application deps (DomainEventBus,
        // UnitOfWork) are provided from the captured singletons; its residual
        // `Database.Database` (the pool, pulled in by the repository Live) is
        // elided here — it, and the ambient `TransactionContext`, are
        // guaranteed present because the immediate bus runs this handler in
        // the publisher's fully-provisioned fiber, so the command's
        // `withUnitOfWork` opens a nested savepoint on the org-creation
        // transaction (wallet + org commit atomically). `orDie` demotes a
        // transient failure to a defect so it rolls the publisher back —
        // collapsing 503 → 500 for this cross-module path, the
        // immediate-consistency contract.
        commandBus
          .execute(CreateWalletCommand.make({ organizationId: event.organizationId }))
          .pipe(
            Effect.provideService(DomainEventBus, domainEventBus),
            Effect.provideService(UnitOfWork, unitOfWork),
            Effect.orDie,
          ) as Effect.Effect<void>,
    );
  }),
);
