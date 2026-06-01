import * as Effect from "effect/Effect";

import { type ResourceCheck } from "@/platform/auth/policy-registry.js";
import { MembershipService } from "@/platform/ddd/ports/membership-service.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";

// Reusable "is this caller a member of the resource's org?" check,
// parameterized by how *this* resource yields its org id.
//
// The membership lookup is the uniform, cross-cutting part — every
// consumer asks the identical `isMember(userId, orgId)` — so it stays
// centralized behind the platform `MembershipService` ACL. The only
// module-specific part is extracting the org id from the resource
// (`organization.id`, `todo.organizationId`, …), so each module supplies
// that one-liner. Platform never learns the consumer's resource shape;
// it only receives the extractor.
//
// Mirrors `SuperAdminOnly` (a platform check over a platform ACL),
// composed as `Authz.any(SuperAdminOnly, makeIsOrgMember(...))`. A module
// needing bespoke membership semantics (e.g. "member OR pending
// invitation") still authors its own check by hand.
export const makeIsOrgMember =
  <R>(getOrganizationId: (resource: R) => OrganizationId): ResourceCheck<R> =>
  (caller, resource) =>
    Effect.gen(function* () {
      const memberships = yield* MembershipService;
      return yield* memberships.isMember(caller.userId, getOrganizationId(resource));
    });
