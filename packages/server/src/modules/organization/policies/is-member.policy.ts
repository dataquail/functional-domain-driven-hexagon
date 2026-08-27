import { type ResourceCheck } from "@effect-server-utils/authz";
import { type PersistenceUnavailable } from "@effect-server-utils/unit-of-work";
import type * as Effect from "effect/Effect";

import { type OrganizationAuthzView } from "@/modules/organization/queries/find-organization-by-id.query.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";
import { type UserId } from "@/platform/ids/user-id.js";

// A question about one user's standing inside one organization. Both of this
// module's org-scoped checks ask a question of this shape, so they share the
// type rather than declaring it twice.
export type UserOrganizationLookup = (
  userId: UserId,
  organizationId: OrganizationId,
) => Effect.Effect<boolean, PersistenceUnavailable>;

// "Is this caller a member of the org?" — the `organization` resource resolves
// to a read-model view, never the aggregate: a check has no business reading
// write-model state.
//
// Memberships are this module's own data, so the lookup arrives as a plain
// function rather than a port: a port pointing at your own module would be a
// middle man. The contribution layer supplies it by dispatching this module's
// own membership policy-query, and the returned check is `R = never`.
export const makeIsMember =
  (isMember: UserOrganizationLookup): ResourceCheck<OrganizationAuthzView> =>
  (caller, organization) =>
    isMember(caller.userId, organization.organizationId);
