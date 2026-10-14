import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id";
import { Criteria } from "@/globals/application/ddd/specification";
import { WalletId } from "@/modules/wallet/domain/wallet/wallet.id";

import { WalletRootOps } from "./wallet.root-ops";
import { WalletSpecifications } from "./wallet.specification";

const acmeId = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const betaId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const walletId = WalletId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const now = DateTime.makeUnsafe("2025-01-01T00:00:00Z");

const acmeWallet = WalletRootOps.create({ id: walletId, organizationId: acmeId, now }).wallet;

describe("WalletSpecifications.forOrganization", () => {
  it("matches the wallet belonging to the given organization and no other", () => {
    deepStrictEqual(WalletSpecifications.forOrganization(acmeId)(acmeWallet), true);
    deepStrictEqual(WalletSpecifications.forOrganization(betaId)(acmeWallet), false);
  });

  it("carries an Eq criteria over the organizationId field", () => {
    deepStrictEqual(
      WalletSpecifications.forOrganization(acmeId).criteria,
      Criteria.Eq({ field: "organizationId", value: acmeId }),
    );
  });
});
