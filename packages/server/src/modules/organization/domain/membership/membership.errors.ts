import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.js";
import { UserId } from "@/globals/application/ddd/ids/user-id.js";

// Returned by the repository when a (userId, organizationId) pair is
// expected to exist but doesn't — e.g. the user removing a member that
// isn't actually a member, or `IsMember` resolving a non-member.
export class MembershipNotFound extends Schema.TaggedErrorClass<MembershipNotFound>(
  "MembershipNotFound",
)("MembershipNotFound", { userId: UserId, organizationId: OrganizationId }) {}
