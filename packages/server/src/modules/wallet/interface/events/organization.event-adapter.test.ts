// Unit test for the organization → wallet inbound adapter. Verifies that
// dispatching OrganizationCreated through the bus makes the adapter dispatch
// a CreateWalletCommand carrying the organizationId. The wallet-creation
// itself is covered by the CreateWallet handler unit test and the adapter
// integration test; this asserts only the adapter glue (subscribe +
// translate + dispatch).

import { describe, it } from "@effect/vitest";
import { Database } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { type OrganizationCreated } from "@/modules/organization/index.js";
import { type CreateWalletCommand } from "@/modules/wallet/commands/create-wallet.command.js";
import { OrganizationEventAdapterLive } from "@/modules/wallet/interface/events/organization.event-adapter.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { makeDomainEventBusLive } from "@/platform/domain-event-bus-live.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { fakeTransaction } from "@/test-utils/fake-transaction-context.js";
import { IdentityUnitOfWork } from "@/test-utils/identity-unit-of-work.js";
import { RecordedCommands, RecordingCommandBus } from "@/test-utils/recording-command-bus.js";

const TestLayer = OrganizationEventAdapterLive.pipe(
  Layer.provideMerge(makeDomainEventBusLive()),
  Layer.provideMerge(RecordingCommandBus),
  Layer.provideMerge(IdentityUnitOfWork),
);

describe("OrganizationEventAdapterLive", () => {
  it.effect("translates OrganizationCreated into a CreateWalletCommand dispatch", () =>
    Effect.gen(function* () {
      const bus = yield* DomainEventBus;
      const rec = yield* RecordedCommands;
      const organizationId = OrganizationId.make("11111111-1111-1111-1111-111111111111");

      // Construct the event as a plain tagged record. The bus dispatches by
      // tag and does not Schema-decode at the boundary.
      const event = {
        _tag: "OrganizationCreated" as const,
        organizationId,
        name: "Acme",
      } as unknown as OrganizationCreated;
      yield* bus.dispatch([event]);

      const commands = yield* rec.byTag<CreateWalletCommand>("CreateWalletCommand");
      deepStrictEqual(commands.length, 1);
      const command = commands[0];
      if (command === undefined) throw new Error("expected a CreateWalletCommand");
      deepStrictEqual(command.organizationId, organizationId);
      // In production this dispatch runs inside `uow.run`; supply a no-op
      // transaction context so the bus's unit-of-work guard passes.
    }).pipe(Database.TransactionContext.provide(fakeTransaction), Effect.provide(TestLayer)),
  );
});
