import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.js";
import { UserId } from "@/globals/application/ddd/ids/user-id.js";

export class OrganizationNotFound extends Schema.TaggedError<OrganizationNotFound>()(
  "OrganizationNotFound",
  { organizationId: OrganizationId },
) {}

// Aggregate invariant: an org can only be soft-deleted once.
export class OrganizationAlreadyDeleted extends Schema.TaggedError<OrganizationAlreadyDeleted>()(
  "OrganizationAlreadyDeleted",
  { organizationId: OrganizationId },
) {}

// Aggregate invariant: an org that hasn't been deleted can't be restored.
export class OrganizationNotDeleted extends Schema.TaggedError<OrganizationNotDeleted>()(
  "OrganizationNotDeleted",
  { organizationId: OrganizationId },
) {}

// Model invariant (not an aggregate one): super-admins are a separate
// user type from regular users — they don't own or join organizations.
// Surfaces from `CreateOrganizationCommand` and `AcceptInvitationCommand`
// when the caller's platform role is `super_admin`.
export class SuperAdminCannotOwnOrganization extends Schema.TaggedError<SuperAdminCannotOwnOrganization>()(
  "SuperAdminCannotOwnOrganization",
  { userId: UserId },
) {}
