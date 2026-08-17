import { Command, PersistenceUnavailable } from "@effect-server-utils/cqrs";
import * as Schema from "effect/Schema";

import { MembershipNotFound } from "@/modules/organization/domain/membership/membership.errors.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

// Self-removal — same persistence shape as RemoveMemberCommand but the actor
// IS the target. Kept as a separate command so the policy layer can
// gate it differently (any member can leave; only admins can remove
// others) and so the bus span/log distinguishes the two flows.
export const LeaveOrganizationCommand = Command.make("LeaveOrganizationCommand", {
  payload: { userId: UserId, organizationId: OrganizationId },
  success: Schema.Void,
  failure: Schema.Union([MembershipNotFound, PersistenceUnavailable]),
});
export type LeaveOrganizationPayload = Command.Payload<typeof LeaveOrganizationCommand>;
