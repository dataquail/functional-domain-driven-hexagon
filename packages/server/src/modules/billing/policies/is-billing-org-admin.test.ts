import "@/modules/billing/policies/billing-policies.js";
import "@/modules/billing/policies/billing-resource-resolver.js";

import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { IsBillingOrgAdmin } from "@/modules/billing/policies/is-billing-org-admin.js";
import { MembershipService } from "@/platform/ddd/ports/membership-service.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import { makeOrganizationRoleServiceFake } from "@/test-utils/organization-role-service-fake.js";
import { makeRoleServiceFake } from "@/test-utils/role-service-fake.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const orgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const caller = { sessionId: "s", userId };
const resource = { organizationId: orgId };

const policyDeps = (admin: boolean) =>
  Layer.mergeAll(
    Layer.succeed(
      MembershipService,
      MembershipService.of({ isMember: () => Effect.succeed(false) }),
    ),
    makeRoleServiceFake(new Map()),
    makeOrganizationRoleServiceFake(
      admin ? new Map([[`${userId}::${orgId}` as const, ["admin"] as const]]) : new Map(),
    ),
  );

describe("IsBillingOrgAdmin", () => {
  it.effect("returns true when the user holds the 'admin' org-role for this org", () =>
    IsBillingOrgAdmin(caller, resource).pipe(
      Effect.tap((result) =>
        Effect.sync(() => {
          deepStrictEqual(result, true);
        }),
      ),
      Effect.provide(policyDeps(true)),
    ),
  );

  it.effect("returns false when the user has no 'admin' role for this org", () =>
    IsBillingOrgAdmin(caller, resource).pipe(
      Effect.tap((result) =>
        Effect.sync(() => {
          deepStrictEqual(result, false);
        }),
      ),
      Effect.provide(policyDeps(false)),
    ),
  );
});
