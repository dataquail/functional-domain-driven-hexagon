import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { PassThroughUnitOfWork } from "@effect-server-utils/unit-of-work/testing";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.js";
import { createWalletHandler } from "@/modules/wallet/commands/create-wallet.handler.js";
import { WalletRepository } from "@/modules/wallet/domain/wallet/wallet.repository.js";
import { WalletSpecifications } from "@/modules/wallet/domain/wallet/wallet.specification.js";
import { WalletRepositoryFake } from "@/modules/wallet/infrastructure/repositories/wallet.repository-fake.js";
import { CryptoFake } from "@/test-utils/crypto-fake.js";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.js";

const organizationId = OrganizationId.make("11111111-1111-1111-1111-111111111111");

const TestLayer = Layer.mergeAll(
  WalletRepositoryFake,
  RecordingEventBus,
  PassThroughUnitOfWork,
  CryptoFake,
);

describe("createWalletHandler", () => {
  it.effect("inserts a wallet with balance 0 and dispatches WalletCreated", () =>
    Effect.gen(function* () {
      const repo = yield* WalletRepository;
      const rec = yield* RecordedEvents;

      yield* createWalletHandler({ organizationId });

      const stored = yield* Effect.fromOption(
        yield* repo.findOne(WalletSpecifications.forOrganization(organizationId)),
      );

      deepStrictEqual(stored.balance, 0);
      deepStrictEqual(stored.organizationId, organizationId);

      const tags = (yield* rec.all).map((e) => e._tag);
      deepStrictEqual(tags, ["WalletCreated"]);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("is idempotent: a duplicate command is a no-op and dispatches no second event", () =>
    Effect.gen(function* () {
      const rec = yield* RecordedEvents;
      yield* createWalletHandler({ organizationId });
      yield* createWalletHandler({ organizationId });
      // Only the first insert emits WalletCreated; the duplicate swallows
      // WalletAlreadyExistsForOrganization and dispatches nothing.
      const tags = (yield* rec.all).map((e) => e._tag);
      deepStrictEqual(tags, ["WalletCreated"]);
    }).pipe(Effect.provide(TestLayer)),
  );
});
