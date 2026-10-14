import { withUnitOfWork } from "@effect-server-utils/unit-of-work";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { DomainEventBus } from "@/globals/application/ports/event-bus";
import { type CreateWalletPayload } from "@/modules/wallet/commands/create-wallet.command";
import { WalletId } from "@/modules/wallet/domain/wallet/wallet.id";
import { WalletRepository } from "@/modules/wallet/domain/wallet/wallet.repository";
import { WalletRootOps } from "@/modules/wallet/domain/wallet/wallet.root-ops";

// Creates the org's wallet with a zero balance. Idempotent: a duplicate
// trigger for an org that already has a wallet is a no-op — the insert's
// `WalletAlreadyExistsForOrganization` is swallowed and `WalletCreated`
// fires only on a fresh insert. Dispatched from the organization event
// adapter inside the publisher's transaction, so `withUnitOfWork` opens a
// nested savepoint and the wallet commits atomically with the org (ADR-0007).
export const createWalletHandler = Effect.fn("createWalletHandler")(function* (
  cmd: CreateWalletPayload,
) {
  const repo = yield* WalletRepository;
  const bus = yield* DomainEventBus;
  const crypto = yield* Crypto.Crypto;
  const id = WalletId.make(yield* Effect.orDie(crypto.randomUUIDv4));
  const now = yield* DateTime.now;
  const { events, wallet } = WalletRootOps.create({ id, organizationId: cmd.organizationId, now });

  const inserted = yield* repo.insertOne(wallet).pipe(
    Effect.as(true),
    Effect.catchTag("WalletAlreadyExistsForOrganization", () => Effect.succeed(false)),
  );

  if (inserted) {
    yield* bus.dispatch(events);
  }
}, withUnitOfWork);
