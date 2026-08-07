import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import { makeIsBillingOrgAdmin } from "@/modules/billing/policies/is-billing-org-admin.policy.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const orgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const caller = { sessionId: "s", userId };
const resource = { organizationId: orgId };

describe("makeIsBillingOrgAdmin", () => {
  it.effect("returns true when the caller holds billing authority for the org", () =>
    Effect.map(
      makeIsBillingOrgAdmin({
        isMember: () => Effect.succeed(true),
        isAdmin: () => Effect.succeed(true),
      })(caller, resource),
      (result) => {
        deepStrictEqual(result, true);
      },
    ),
  );

  it.effect("returns false for a plain member — membership alone is not authority", () =>
    Effect.map(
      makeIsBillingOrgAdmin({
        isMember: () => Effect.succeed(true),
        isAdmin: () => Effect.succeed(false),
      })(caller, resource),
      (result) => {
        deepStrictEqual(result, false);
      },
    ),
  );

  it.effect("asks about the caller and the resource's org", () => {
    const seen: Array<{ userId: UserId; organizationId: OrganizationId }> = [];
    return Effect.map(
      makeIsBillingOrgAdmin({
        isMember: () => Effect.succeed(false),
        isAdmin: (askedUser, askedOrg) => {
          seen.push({ userId: askedUser, organizationId: askedOrg });
          return Effect.succeed(true);
        },
      })(caller, resource),
      () => {
        deepStrictEqual(seen, [{ userId, organizationId: orgId }]);
      },
    );
  });
});
