import { Command } from "@org/cqrs";
import * as Schema from "effect/Schema";

import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

export const InviteUser = Command.make("InviteUserCommand", {
  payload: {
    organizationId: OrganizationId,
    inviteeEmail: Schema.String.check(Schema.isMinLength(3), Schema.isMaxLength(320)),
    ttlSeconds: Schema.Number,
    actorUserId: UserId,
  },
  success: InvitationId,
  failure: PersistenceUnavailable,
});
export type InviteUserPayload = Command.Payload<typeof InviteUser>;
