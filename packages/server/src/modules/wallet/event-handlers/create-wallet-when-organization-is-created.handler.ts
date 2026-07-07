// Wallet's reaction to an "organization was created" trigger. Imports
// the wallet-internal `OrganizationCreatedTrigger` from ./triggers/ —
// NOT `OrganizationCreated` from `@/modules/organization/index.js`. The
// translation happens in ./organization-event-adapter.ts, which is the
// only file allowed to cross the boundary.
//
// Runs synchronously inside the publisher's transaction (ADR-0007),
// so an unexpected failure rolls back the originating org-creation.
// The `WalletAlreadyExistsForOrganization` catch is a defensive idempotency
// net for a case that shouldn't occur given a freshly-minted org id;
// any other error propagates as a defect.

import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { WalletRepository } from "@/modules/wallet/domain/ports/repositories/wallet.repository.js";
import { WalletId } from "@/modules/wallet/domain/wallet.id.js";
import { WalletRootOps } from "@/modules/wallet/domain/wallet.root.js";

import { type OrganizationCreatedTrigger } from "./triggers/organization.triggers.js";

export const handleOrganizationCreated = (trigger: OrganizationCreatedTrigger) =>
  Effect.gen(function* () {
    const repo = yield* WalletRepository;
    const id = WalletId.make(yield* Effect.sync(() => crypto.randomUUID()));
    const now = yield* DateTime.now;
    const { wallet } = WalletRootOps.create({ id, organizationId: trigger.organizationId, now });
    yield* repo
      .insertOne(wallet)
      .pipe(Effect.catchTag("WalletAlreadyExistsForOrganization", () => Effect.void));
  });
