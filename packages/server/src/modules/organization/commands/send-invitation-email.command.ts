import { Command, PersistenceUnavailable } from "@org/cqrs";
import * as Schema from "effect/Schema";

import { InvitationId } from "@/platform/ids/invitation-id.js";

// Carries only the id. The accept link needs the invitation's token, but a token
// is a bearer credential and this payload is the kind of thing an outbox would
// persist — so the handler reads it back from the row instead of it travelling
// here or on the event that triggers the command.
export const SendInvitationEmailCommand = Command.make("SendInvitationEmailCommand", {
  payload: { invitationId: InvitationId },
  success: Schema.Void,
  failure: PersistenceUnavailable,
});
export type SendInvitationEmailPayload = Command.Payload<typeof SendInvitationEmailCommand>;
