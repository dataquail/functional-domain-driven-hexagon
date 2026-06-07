import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { SubscriptionRepository } from "@/modules/billing/domain/ports/repositories/subscription-repository.js";
import * as Subscription from "@/modules/billing/domain/subscription.aggregate.js";
import { SubscriptionId } from "@/modules/billing/domain/subscription-id.js";
import { SubscriptionRepositoryFake } from "@/modules/billing/infrastructure/subscription-repository-fake.js";
import { findSubscriptionByOrganization } from "@/modules/billing/queries/find-subscription-by-organization.js";
import { FindSubscriptionByOrganizationQuery } from "@/modules/billing/queries/find-subscription-by-organization-query.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

const acme = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const beta = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const subId = SubscriptionId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const now = DateTime.unsafeMake(new Date("2025-01-01T00:00:00Z"));

const provide = Effect.provide(SubscriptionRepositoryFake);

describe("findSubscriptionByOrganization", () => {
  it.effect(
    "returns Some(view) when a subscription exists, mapping to the cross-boundary shape",
    () =>
      Effect.gen(function* () {
        const repo = yield* SubscriptionRepository;
        const { subscription } = Subscription.create({
          id: subId,
          organizationId: acme,
          stripeCustomerId: "cus_acme",
          stripeSubscriptionId: "sub_acme",
          status: "active",
          currentPeriodEnd: null,
          now,
        });
        yield* repo.insert(subscription);

        const result = yield* findSubscriptionByOrganization(
          FindSubscriptionByOrganizationQuery.make({ organizationId: acme }),
        );
        ok(Option.isSome(result));
        if (Option.isSome(result)) {
          deepStrictEqual(result.value.id, subId);
          deepStrictEqual(result.value.organizationId, acme);
          deepStrictEqual(result.value.status, "active");
        }
      }).pipe(provide),
  );

  it.effect("returns None when no subscription exists for the org", () =>
    Effect.gen(function* () {
      const result = yield* findSubscriptionByOrganization(
        FindSubscriptionByOrganizationQuery.make({ organizationId: beta }),
      );
      ok(Option.isNone(result));
    }).pipe(provide),
  );
});
