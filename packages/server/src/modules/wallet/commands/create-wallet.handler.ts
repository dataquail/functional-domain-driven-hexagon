import * as crypto from "node:crypto";

import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { type CreateWalletCommand } from "@/modules/wallet/commands/create-wallet.command.js";
import { WalletRepository } from "@/modules/wallet/domain/ports/repositories/wallet.repository.js";
import { WalletId } from "@/modules/wallet/domain/wallet.id.js";
import { WalletRootOps } from "@/modules/wallet/domain/wallet.root-ops.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { withUnitOfWork } from "@/platform/ddd/ports/with-unit-of-work.js";

// Creates the org's wallet with a zero balance. Idempotent: a duplicate
// trigger for an org that already has a wallet is a no-op — the insert's
// `WalletAlreadyExistsForOrganization` is swallowed and `WalletCreated`
// fires only on a fresh insert. Dispatched from the organization event
// adapter inside the publisher's transaction, so `withUnitOfWork` opens a
// nested savepoint and the wallet commits atomically with the org (ADR-0007).
export const createWallet = Effect.fn("createWallet")(function* (cmd: CreateWalletCommand) {
  const repo = yield* WalletRepository;
  const bus = yield* DomainEventBus;
  const id = WalletId.make(crypto.randomUUID());
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
