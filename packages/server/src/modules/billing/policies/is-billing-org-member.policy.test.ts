// Side-effect imports for `declare module` augmentations that register
// `billing` in PolicyMap / ResourceResolverMap, which `ResourceCheck`
// composes against.
import "@/modules/billing/policies/billing.policies.js";
import "@/modules/billing/policies/billing.resource-resolver.js";

import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { IsBillingOrgMember } from "@/modules/billing/policies/is-billing-org-member.policy.js";
import { MembershipService } from "@/platform/ddd/ports/membership-service.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import { makeOrganizationRoleServiceFake } from "@/test-utils/organization-role-service-fake.js";
import { makeRoleServiceFake } from "@/test-utils/role-service-fake.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const orgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const caller = { sessionId: "s", userId };
const resource = { organizationId: orgId };

const membershipFake = (isMember: boolean) =>
  Layer.succeed(
    MembershipService,
    MembershipService.of({ isMember: () => Effect.succeed(isMember) }),
  );

// Full PolicyDeps fake (every ACL) — `IsBillingOrgMember` only touches
// `MembershipService`, but the registry type's R channel declares all
// three, so we satisfy them as empty fakes.
const PolicyDepsFake = (isMember: boolean) =>
  Layer.mergeAll(
    membershipFake(isMember),
    makeRoleServiceFake(new Map()),
    makeOrganizationRoleServiceFake(),
  );

describe("IsBillingOrgMember", () => {
  it.effect("returns true when MembershipService reports membership", () =>
    IsBillingOrgMember(caller, resource).pipe(
      Effect.tap((result) =>
        Effect.sync(() => {
          deepStrictEqual(result, true);
        }),
      ),
      Effect.provide(PolicyDepsFake(true)),
    ),
  );

  it.effect("returns false when MembershipService reports non-membership", () =>
    IsBillingOrgMember(caller, resource).pipe(
      Effect.tap((result) =>
        Effect.sync(() => {
          deepStrictEqual(result, false);
        }),
      ),
      Effect.provide(PolicyDepsFake(false)),
    ),
  );
});
