import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";

import { makeIsBillingOrgMember } from "@/modules/billing/policies/is-billing-org-member.policy.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const orgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const caller = { sessionId: "s", userId };
const resource = { organizationId: orgId };

// The check closes over its port, so there is nothing to provide.
const access = (isMember: boolean) => ({
  isMember: () => Effect.succeed(isMember),
  isAdmin: () => Effect.succeed(false),
});

describe("makeIsBillingOrgMember", () => {
  it.effect("returns true for a member of the billing resource's org", () =>
    Effect.map(makeIsBillingOrgMember(access(true))(caller, resource), (result) => {
      deepStrictEqual(result, true);
    }),
  );

  it.effect("returns false for a non-member", () =>
    Effect.map(makeIsBillingOrgMember(access(false))(caller, resource), (result) => {
      deepStrictEqual(result, false);
    }),
  );

  it.effect("asks about membership, not admin authority", () => {
    const asked: Array<string> = [];
    return Effect.map(
      makeIsBillingOrgMember({
        isMember: () => {
          asked.push("isMember");
          return Effect.succeed(true);
        },
        isAdmin: () => {
          asked.push("isAdmin");
          return Effect.succeed(true);
        },
      })(caller, resource),
      () => {
        deepStrictEqual(asked, ["isMember"]);
      },
    );
  });
});
