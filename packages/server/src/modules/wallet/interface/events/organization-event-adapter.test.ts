// Unit test for the organization → wallet ACL. Verifies that dispatching
// OrganizationCreated through the bus reaches the wallet handler with
// the organizationId carried through the trigger translation. The
// handler's repository interactions are covered separately by the
// integration test for the publisher-bound flow; this test only
// asserts the adapter glue (subscribe + translate).

import { describe, it } from "@effect/vitest";
import { Database } from "@org/database/index";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { type OrganizationCreated } from "@/modules/organization/index.js";
import { WalletRepository } from "@/modules/wallet/domain/ports/repositories/wallet-repository.js";
import { WalletRepositoryFake } from "@/modules/wallet/infrastructure/wallet-repository-fake.js";
import { OrganizationEventAdapterLive } from "@/modules/wallet/interface/events/organization-event-adapter.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { makeDomainEventBusLive } from "@/platform/domain-event-bus-live.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { fakeTransaction } from "@/test-utils/fake-transaction-context.js";

const TestLayer = OrganizationEventAdapterLive.pipe(
  Layer.provideMerge(makeDomainEventBusLive()),
  Layer.provideMerge(WalletRepositoryFake),
);

describe("OrganizationEventAdapterLive", () => {
  it.effect(
    "translates OrganizationCreated into the wallet handler's trigger and inserts a wallet",
    () =>
      Effect.gen(function* () {
        const bus = yield* DomainEventBus;
        const repo = yield* WalletRepository;
        const organizationId = OrganizationId.make("11111111-1111-1111-1111-111111111111");

        // Construct the event as a plain tagged record. The bus dispatches
        // by tag and does not Schema-decode at the boundary, so we don't
        // need a proper Schema-Class instance for this adapter-glue test.
        const event = {
          _tag: "OrganizationCreated" as const,
          organizationId,
          name: "Acme",
        } as unknown as OrganizationCreated;
        yield* bus.dispatch([event]);

        const wallet = yield* repo.findOneByOrganizationId(organizationId);
        ok(Option.isSome(wallet));
        deepStrictEqual(Option.getOrThrow(wallet).organizationId, organizationId);
        // In production this dispatch runs inside `uow.run`; supply a no-op
        // transaction context so the bus's unit-of-work guard passes.
      }).pipe(Database.TransactionContext.provide(fakeTransaction), Effect.provide(TestLayer)),
  );
});
