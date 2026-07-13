import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";

import { CreateWalletCommand } from "@/modules/wallet/commands/create-wallet.command.js";
import { createWallet } from "@/modules/wallet/commands/create-wallet.handler.js";
import { WalletRepository } from "@/modules/wallet/domain/wallet/wallet.repository.js";
import { WalletSpecifications } from "@/modules/wallet/domain/wallet/wallet.specification.js";
import { WalletRepositoryFake } from "@/modules/wallet/infrastructure/repositories/wallet.repository-fake.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { IdentityUnitOfWork } from "@/test-utils/identity-unit-of-work.js";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.js";

const organizationId = OrganizationId.make("11111111-1111-1111-1111-111111111111");

const TestLayer = Layer.mergeAll(WalletRepositoryFake, RecordingEventBus, IdentityUnitOfWork);

describe("createWallet", () => {
  it.effect("inserts a wallet with balance 0 and dispatches WalletCreated", () =>
    Effect.gen(function* () {
      const repo = yield* WalletRepository;
      const rec = yield* RecordedEvents;

      yield* createWallet(CreateWalletCommand.make({ organizationId }));

      const stored = yield* repo.findOne(WalletSpecifications.forOrganization(organizationId));
      deepStrictEqual(stored !== null, true);
      if (stored !== null) {
        deepStrictEqual(stored.balance, 0);
        deepStrictEqual(stored.organizationId, organizationId);
      }

      const tags = (yield* rec.all).map((e) => e._tag);
      deepStrictEqual(tags, ["WalletCreated"]);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("is idempotent: a duplicate command is a no-op and dispatches no second event", () =>
    Effect.gen(function* () {
      const rec = yield* RecordedEvents;
      yield* createWallet(CreateWalletCommand.make({ organizationId }));
      const exit = yield* Effect.exit(createWallet(CreateWalletCommand.make({ organizationId })));
      deepStrictEqual(Exit.isSuccess(exit), true);
      // Only the first insert emits WalletCreated; the duplicate swallows
      // WalletAlreadyExistsForOrganization and dispatches nothing.
      const tags = (yield* rec.all).map((e) => e._tag);
      deepStrictEqual(tags, ["WalletCreated"]);
    }).pipe(Effect.provide(TestLayer)),
  );
});
