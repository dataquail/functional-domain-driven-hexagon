import * as Schema from "effect/Schema";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

export class OrganizationNotFound extends Schema.TaggedErrorClass<OrganizationNotFound>(
  "OrganizationNotFound",
)("OrganizationNotFound", { organizationId: OrganizationId }) {}

// Aggregate invariant: an org can only be soft-deleted once.
export class OrganizationAlreadyDeleted extends Schema.TaggedErrorClass<OrganizationAlreadyDeleted>(
  "OrganizationAlreadyDeleted",
)("OrganizationAlreadyDeleted", { organizationId: OrganizationId }) {}

// Aggregate invariant: an org that hasn't been deleted can't be restored.
export class OrganizationNotDeleted extends Schema.TaggedErrorClass<OrganizationNotDeleted>(
  "OrganizationNotDeleted",
)("OrganizationNotDeleted", { organizationId: OrganizationId }) {}

// Model invariant (not an aggregate one): super-admins are a separate
// user type from regular users — they don't own or join organizations.
// Surfaces from `CreateOrganizationCommand` and `AcceptInvitationCommand`
// when the caller's platform role is `super_admin`.
export class SuperAdminCannotOwnOrganization extends Schema.TaggedErrorClass<SuperAdminCannotOwnOrganization>(
  "SuperAdminCannotOwnOrganization",
)("SuperAdminCannotOwnOrganization", { userId: UserId }) {}
