import { Command } from "@effect-server-utils/cqrs";
import { PersistenceUnavailable } from "@effect-server-utils/unit-of-work";
import * as Schema from "effect/Schema";

import { InvitationId } from "@/globals/application/ddd/ids/invitation-id.js";
import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.js";
import { UserId } from "@/globals/application/ddd/ids/user-id.js";

export const InviteUserCommand = Command.make("InviteUserCommand", {
  payload: {
    organizationId: OrganizationId,
    inviteeEmail: Schema.String.check(Schema.isMinLength(3), Schema.isMaxLength(320)),
    ttlSeconds: Schema.Int,
    actorUserId: UserId,
  },
  success: InvitationId,
  failure: PersistenceUnavailable,
});
export type InviteUserPayload = Command.Payload<typeof InviteUserCommand>;
