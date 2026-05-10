// Unit test for the user → wallet ACL. Verifies that dispatching
// UserCreated through the bus reaches the wallet handler with the
// userId carried through the trigger translation. The handler's
// repository interactions are covered separately by the
// integration test for the publisher-bound flow; this test only
// asserts the adapter glue (subscribe + translate).

import { type UserCreated } from "@/modules/user/index.js";
import { WalletRepository } from "@/modules/wallet/domain/wallet-repository.js";
import { UserEventAdapterLive } from "@/modules/wallet/event-handlers/user-event-adapter.js";
import { WalletRepositoryFake } from "@/modules/wallet/infrastructure/wallet-repository-fake.js";
import { DomainEventBus, makeDomainEventBusLive } from "@/platform/domain-event-bus.js";
import { UserId } from "@/platform/ids/user-id.js";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

const TestLayer = UserEventAdapterLive.pipe(
  Layer.provideMerge(makeDomainEventBusLive()),
  Layer.provideMerge(WalletRepositoryFake),
);

describe("UserEventAdapterLive", () => {
  it.effect("translates UserCreated into the wallet handler's trigger and inserts a wallet", () =>
    Effect.gen(function* () {
      const bus = yield* DomainEventBus;
      const repo = yield* WalletRepository;
      const userId = UserId.make("11111111-1111-1111-1111-111111111111");

      // Construct the event as a plain tagged record. The bus dispatches
      // by tag and does not Schema-decode at the boundary, so we don't
      // need a proper Address class instance for this adapter-glue test.
      const event = {
        _tag: "UserCreated" as const,
        userId,
        email: "u@example.com",
        address: { country: "USA", street: "Main", postalCode: "12345" },
      } as unknown as UserCreated;
      yield* bus.dispatch([event]);

      const wallet = yield* repo.findByUserId(userId);
      ok(Option.isSome(wallet));
      deepStrictEqual(Option.getOrThrow(wallet).userId, userId);
    }).pipe(Effect.provide(TestLayer)),
  );
});
