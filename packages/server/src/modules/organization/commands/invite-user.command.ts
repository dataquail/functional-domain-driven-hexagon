import { Command, PersistenceUnavailable } from "@effect-server-utils/cqrs";
import * as Schema from "effect/Schema";

import { InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

export const InviteUserCommand = Command.make("InviteUserCommand", {
  payload: {
    organizationId: OrganizationId,
    inviteeEmail: Schema.String.check(Schema.isMinLength(3), Schema.isMaxLength(320)),
    ttlSeconds: Schema.Number,
    actorUserId: UserId,
  },
  success: InvitationId,
  failure: PersistenceUnavailable,
});
export type InviteUserPayload = Command.Payload<typeof InviteUserCommand>;
