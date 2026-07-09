import * as Schema from "effect/Schema";

import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

// Self-removal — same persistence shape as RemoveMember but the actor
// IS the target. Kept as a separate command so the policy layer can
// gate it differently (any member can leave; only admins can remove
// others) and so the bus span/log distinguishes the two flows.
export const LeaveOrganizationCommand = Schema.TaggedStruct("LeaveOrganizationCommand", {
  userId: UserId,
  organizationId: OrganizationId,
});
export type LeaveOrganizationCommand = typeof LeaveOrganizationCommand.Type;

export const leaveOrganizationCommandSpanAttributes: SpanAttributesExtractor<
  LeaveOrganizationCommand
> = (cmd) => ({ "user.id": cmd.userId, "organization.id": cmd.organizationId });
