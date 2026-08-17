// Unit test for the organization → wallet inbound adapter. Verifies that
// dispatching OrganizationCreated through the bus makes the adapter dispatch
// a CreateWalletCommand carrying the organizationId. The wallet-creation
// itself is covered by the CreateWalletCommand handler unit test and the adapter
// integration test; this asserts only the adapter glue (subscribe +
// translate + dispatch).

import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { makeEventBus, UnitOfWork } from "@effect-server-utils/cqrs";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { type OrganizationCreated } from "@/modules/organization/index.js";
import { CreateWalletCommand } from "@/modules/wallet/commands/create-wallet.command.js";
import { OrganizationEventAdapterLive } from "@/modules/wallet/interface/events/organization.event-adapter.js";
import { DomainEventBus } from "@/platform/ddd/event-bus.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { IdentityUnitOfWork } from "@/test-utils/identity-unit-of-work.js";
import { RecordedCommands, RecordingCommandBus } from "@/test-utils/recording-command-bus.js";

const TestLayer = OrganizationEventAdapterLive.pipe(
  Layer.provideMerge(makeEventBus()),
  Layer.provideMerge(RecordingCommandBus),
  Layer.provideMerge(IdentityUnitOfWork),
);

describe("OrganizationEventAdapterLive", () => {
  it.effect("translates OrganizationCreated into a CreateWalletPayload dispatch", () =>
    Effect.gen(function* () {
      const bus = yield* DomainEventBus;
      const uow = yield* UnitOfWork;
      const rec = yield* RecordedCommands;
      const organizationId = OrganizationId.make("11111111-1111-1111-1111-111111111111");

      // Construct the event as a plain tagged record. The bus dispatches by
      // tag and does not Schema-decode at the boundary.
      const event = {
        _tag: "OrganizationCreated" as const,
        organizationId,
        name: "Acme",
      } as unknown as OrganizationCreated;
      // Dispatched inside a unit of work, as a publishing command would.
      yield* uow.run(bus.dispatch([event]));

      const payloads = yield* rec.payloadsFor(CreateWalletCommand);
      deepStrictEqual(payloads, [{ organizationId }]);
    }).pipe(Effect.provide(TestLayer)),
  );
});
