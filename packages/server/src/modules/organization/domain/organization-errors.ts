import * as Schema from "effect/Schema";

import { OrganizationId } from "@/platform/ids/organization-id.js";

export class OrganizationNotFound extends Schema.TaggedError<OrganizationNotFound>(
  "OrganizationNotFound",
)("OrganizationNotFound", { organizationId: OrganizationId }) {}

// Aggregate invariant: an org can only be soft-deleted once.
export class OrganizationAlreadyDeleted extends Schema.TaggedError<OrganizationAlreadyDeleted>(
  "OrganizationAlreadyDeleted",
)("OrganizationAlreadyDeleted", { organizationId: OrganizationId }) {}

// Aggregate invariant: an org that hasn't been deleted can't be restored.
export class OrganizationNotDeleted extends Schema.TaggedError<OrganizationNotDeleted>(
  "OrganizationNotDeleted",
)("OrganizationNotDeleted", { organizationId: OrganizationId }) {}
