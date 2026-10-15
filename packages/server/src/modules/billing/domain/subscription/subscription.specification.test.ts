import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id";
import { Criteria } from "@/globals/application/ddd/specification";

import { SubscriptionId } from "./subscription.id";
import { SubscriptionRootOps } from "./subscription.root-ops";
import { SubscriptionSpecifications } from "./subscription.specification";

const acme = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const beta = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const subId = SubscriptionId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const now = DateTime.makeUnsafe("2025-01-01T00:00:00Z");

const acmeSub = SubscriptionRootOps.create({
  id: subId,
  organizationId: acme,
  stripeCustomerId: "cus_x",
  stripeSubscriptionId: "sub_x",
  status: "active",
  currentPeriodEnd: Option.none(),
  now,
}).subscription;

describe("SubscriptionSpecifications.forOrganization", () => {
  it("matches the subscription for the given organization and no other", () => {
    deepStrictEqual(SubscriptionSpecifications.forOrganization(acme)(acmeSub), true);
    deepStrictEqual(SubscriptionSpecifications.forOrganization(beta)(acmeSub), false);
  });

  it("carries an Eq criteria over the organization_id column", () => {
    deepStrictEqual(
      SubscriptionSpecifications.forOrganization(acme).criteria,
      Criteria.Eq({ field: "organizationId", value: acme }),
    );
  });
});

describe("SubscriptionSpecifications.withStripeSubscriptionId", () => {
  it("matches the subscription with the given Stripe subscription id and no other", () => {
    deepStrictEqual(SubscriptionSpecifications.withStripeSubscriptionId("sub_x")(acmeSub), true);
    deepStrictEqual(SubscriptionSpecifications.withStripeSubscriptionId("sub_y")(acmeSub), false);
  });

  it("carries an Eq criteria over the stripe_subscription_id column", () => {
    deepStrictEqual(
      SubscriptionSpecifications.withStripeSubscriptionId("sub_x").criteria,
      Criteria.Eq({ field: "stripeSubscriptionId", value: "sub_x" }),
    );
  });
});
