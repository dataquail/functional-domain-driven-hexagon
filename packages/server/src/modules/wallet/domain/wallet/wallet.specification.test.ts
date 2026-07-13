import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";

import { WalletId } from "@/modules/wallet/domain/wallet/wallet.id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

import { WalletRootOps } from "./wallet.root-ops.js";
import { WalletSpecifications } from "./wallet.specification.js";

const acmeId = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const betaId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const walletId = WalletId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const now = DateTime.makeUnsafe(new Date("2025-01-01T00:00:00Z"));

const acmeWallet = WalletRootOps.create({ id: walletId, organizationId: acmeId, now }).wallet;

describe("WalletSpecifications.forOrganization", () => {
  it("matches the wallet belonging to the given organization and no other", () => {
    deepStrictEqual(WalletSpecifications.forOrganization(acmeId)(acmeWallet), true);
    deepStrictEqual(WalletSpecifications.forOrganization(betaId)(acmeWallet), false);
  });

  it("carries an Eq criteria over the organizationId field", () => {
    deepStrictEqual(WalletSpecifications.forOrganization(acmeId).criteria, {
      _tag: "Eq",
      field: "organizationId",
      value: acmeId,
    });
  });
});
