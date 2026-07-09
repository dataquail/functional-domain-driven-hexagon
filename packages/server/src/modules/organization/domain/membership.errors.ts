import * as Schema from "effect/Schema";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

// Returned by the repository when a (userId, organizationId) pair is
// expected to exist but doesn't — e.g. the user removing a member that
// isn't actually a member, or `IsMember` resolving a non-member.
export class MembershipNotFound extends Schema.TaggedErrorClass<MembershipNotFound>(
  "MembershipNotFound",
)("MembershipNotFound", { userId: UserId, organizationId: OrganizationId }) {}
