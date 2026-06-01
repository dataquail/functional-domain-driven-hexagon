import { makeIsOrgMember } from "@/platform/auth/policies/is-org-member.js";
import type * as PolicyRegistry from "@/platform/auth/policy-registry.js";

// "Is this caller a member of the org?" — the `organization` resource
// resolves to the Organization aggregate, so the org id is `.id`. All
// the lookup logic lives in the shared `makeIsOrgMember` factory
// (platform), over the `MembershipService` ACL. Composed via
// `Authz.any(SuperAdminOnly, IsMember)` so super-admins bypass.
export const IsMember: PolicyRegistry.CheckFor<"organization", "update"> = makeIsOrgMember(
  (organization) => organization.id,
);
