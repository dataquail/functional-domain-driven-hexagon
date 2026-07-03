import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";

import { WalletRepository } from "@/modules/wallet/domain/ports/repositories/wallet.repository.js";
import { WalletId } from "@/modules/wallet/domain/wallet.id.js";
import { WalletRootOps } from "@/modules/wallet/domain/wallet.root.js";
import { WalletRepositoryFake } from "@/modules/wallet/infrastructure/repositories/wallet.repository-fake.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

import { handleOrganizationCreated } from "./create-wallet-when-organization-is-created.handler.js";
import { type OrganizationCreatedTrigger } from "./triggers/organization.triggers.js";

const acmeId = OrganizationId.make("11111111-1111-1111-1111-111111111111");

const trigger = (organizationId: OrganizationId): OrganizationCreatedTrigger => ({
  organizationId,
});

const seedWallet = (organizationId: OrganizationId) =>
  Effect.gen(function* () {
    const repo = yield* WalletRepository;
    const id = WalletId.make("99999999-9999-9999-9999-999999999999");
    const now = yield* DateTime.now;
    const { wallet } = WalletRootOps.create({ id, organizationId, now });
    yield* repo.insertOne(wallet);
  });

describe("createWalletWhenOrganizationIsCreated (handleOrganizationCreated)", () => {
  it.effect("inserts a wallet with balance=0 carrying the trigger's organizationId", () =>
    Effect.gen(function* () {
      yield* handleOrganizationCreated(trigger(acmeId));
      const repo = yield* WalletRepository;
      const stored = yield* repo.findOneByOrganizationId(acmeId);
      ok(Option.isSome(stored));
      deepStrictEqual(stored.value.balance, 0);
      deepStrictEqual(stored.value.organizationId, acmeId);
    }).pipe(Effect.provide(WalletRepositoryFake)),
  );

  it.effect(
    "swallows WalletAlreadyExistsForOrganization so a duplicate trigger is a no-op (idempotent at the handler boundary)",
    () =>
      Effect.gen(function* () {
        yield* seedWallet(acmeId);
        const exit = yield* Effect.exit(handleOrganizationCreated(trigger(acmeId)));
        deepStrictEqual(Exit.isSuccess(exit), true);
      }).pipe(Effect.provide(WalletRepositoryFake)),
  );

  it.effect(
    "propagates non-idempotency failures as defects (publisher transaction would roll back)",
    () =>
      Effect.gen(function* () {
        const FailingRepo = Effect.provideService(WalletRepository, {
          insertOne: () => Effect.die("simulated infrastructure failure"),
          findOneByOrganizationId: () => Effect.succeed(Option.none()),
        });
        const exit = yield* Effect.exit(
          handleOrganizationCreated(trigger(acmeId)).pipe(FailingRepo),
        );
        deepStrictEqual(Exit.isFailure(exit), true);
        if (Exit.isFailure(exit)) {
          // A defect (Die), not a typed Fail — the catchTag in the handler
          // does not match, so the failure propagates out and would reach
          // the surrounding `tx.run` to trigger rollback.
          deepStrictEqual(exit.cause._tag, "Die");
        }
      }),
  );
});
