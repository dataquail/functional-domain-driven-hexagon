import * as crypto from "node:crypto";

// The bearer credential an invitee presents to accept — 256 bits of
// entropy in URL-safe base64. Generated in the command layer (not the
// aggregate) because randomness is an infrastructure concern. Shared by
// `inviteUser` (issue) and `resendInvitation` (reissue) so both produce
// tokens of the same shape.
export const generateInvitationToken = (): string =>
  crypto
    .randomBytes(32)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
