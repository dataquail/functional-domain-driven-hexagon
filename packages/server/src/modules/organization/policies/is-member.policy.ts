import * as Effect from "effect/Effect";

import { makeIsOrgMember } from "@/platform/auth/policies/is-org-member.js";
import type * as PolicyRegistry from "@/platform/auth/policy-registry.js";

import { type OrganizationRoot } from "../domain/organization/organization.root.js";

// "Is this caller a member of the org?" — the `organization` resource
// resolves to the OrganizationRoot aggregate, so the org id is `.id`. All
// the lookup logic lives in the shared `makeIsOrgMember` factory
// (platform), over the `MembershipService` ACL. Composed via
// `Authz.any(SuperAdminOnly, IsMember)` so super-admins bypass.
export const IsMember: PolicyRegistry.CheckFor<"organization", "update"> = makeIsOrgMember(
  (organization) => organization.id,
);

const isOrgMember = makeIsOrgMember<OrganizationRoot>((organization) => organization.id);

// Read-side member check for `organization.read`. That policy entry is
// shared by two call sites: `findMembers` (passes an orgId → the
// resolver loads the OrganizationRoot, and this check runs normally) and
// the super-admin `findAll` listing (no id → no resource resolved).
// `findAll` is reached only through `Check.any(SuperAdminOnly, …)`, so a
// super-admin short-circuits to `true` before this runs; a non-super-
// admin with no resource can't be "a member of nothing," so we deny.
// The runtime `undefined` is why this can't just reuse `IsMember`.
export const IsMemberRead: PolicyRegistry.CheckFor<"organization", "read"> = (
  caller,
  organization,
) =>
  (organization as OrganizationRoot | undefined) === undefined
    ? Effect.succeed(false)
    : isOrgMember(caller, organization);
