// Unit test for the organization → wallet inbound adapter. Verifies that
// dispatching OrganizationCreated through the bus makes the adapter dispatch
// a CreateWalletCommand carrying the organizationId. The wallet-creation
// itself is covered by the CreateWalletCommand handler unit test and the adapter
// integration test; this asserts only the adapter glue (subscribe +
// translate + dispatch).

import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { makeEventBus } from "@effect-server-utils/cqrs";
import { UnitOfWork } from "@effect-server-utils/unit-of-work";
import { PassThroughUnitOfWork } from "@effect-server-utils/unit-of-work/testing";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.ts";
import { DomainEventBus } from "@/globals/application/ports/event-bus.ts";
import { organizationAccessDomainEvents } from "@/modules/organization/organization.exports.ts";
import { CreateWalletCommand } from "@/modules/wallet/commands/create-wallet.command.ts";
import { OrganizationEventAdapterLive } from "@/modules/wallet/interface/events/organization.event-adapter.ts";
import { RecordedCommands, RecordingCommandBus } from "@/test-utils/recording-command-bus.ts";

const TestLayer = OrganizationEventAdapterLive.pipe(
  Layer.provideMerge(makeEventBus()),
  Layer.provideMerge(RecordingCommandBus),
  Layer.provideMerge(PassThroughUnitOfWork),
);

describe("OrganizationEventAdapterLive", () => {
  it.effect("translates OrganizationCreated into a CreateWalletPayload dispatch", () =>
    Effect.gen(function* () {
      const bus = yield* DomainEventBus;
      const uow = yield* UnitOfWork;
      const rec = yield* RecordedCommands;
      const organizationId = OrganizationId.make("11111111-1111-1111-1111-111111111111");

      const event = organizationAccessDomainEvents.OrganizationCreated.make({
        organizationId,
        name: "Acme",
      });

      // Dispatched inside a unit of work, as a publishing command would.
      yield* uow.run(bus.dispatch([event]));

      const payloads = yield* rec.payloadsFor(CreateWalletCommand);
      deepStrictEqual(payloads, [{ organizationId }]);
    }).pipe(Effect.provide(TestLayer)),
  );
});
