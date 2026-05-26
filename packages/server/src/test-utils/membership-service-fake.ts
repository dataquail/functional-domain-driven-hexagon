import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { MembershipService } from "@/platform/ddd/membership-service.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";
import { type UserId } from "@/platform/ids/user-id.js";

// Factory for an in-memory `MembershipService` Layer keyed by a
// `${userId}::${organizationId}` composite. Use in unit tests of
// policies / checks that depend on org membership, where you don't
// want to wire the org module's repository + plumbing just to validate
// a boolean predicate.
export const makeMembershipServiceFake = (
  membershipsByPair: ReadonlySet<`${UserId}::${OrganizationId}`> = new Set(),
) =>
  Layer.succeed(
    MembershipService,
    MembershipService.of({
      isMember: (userId, organizationId) =>
        Effect.succeed(membershipsByPair.has(`${userId}::${organizationId}`)),
    }),
  );
