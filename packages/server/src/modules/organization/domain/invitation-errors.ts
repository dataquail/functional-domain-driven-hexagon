import * as Schema from "effect/Schema";

import { InvitationId } from "@/platform/ids/invitation-id.js";

// Returned by the repository when a lookup by id finds nothing.
export class InvitationNotFound extends Schema.TaggedError<InvitationNotFound>(
  "InvitationNotFound",
)("InvitationNotFound", { invitationId: InvitationId }) {}

// Returned by the repository when a lookup by token finds nothing.
// Distinct from `InvitationNotFound` so the public accept endpoint's
// error doesn't have to fabricate an id; the token itself isn't
// included to avoid leaking it to span attributes / logs.
export class InvitationTokenNotFound extends Schema.TaggedError<InvitationTokenNotFound>(
  "InvitationTokenNotFound",
)("InvitationTokenNotFound", {}) {}

// Aggregate invariant: accept fails if `expiresAt < now`.
export class InvitationExpired extends Schema.TaggedError<InvitationExpired>("InvitationExpired")(
  "InvitationExpired",
  { invitationId: InvitationId },
) {}

// Aggregate invariant: accept + revoke both fail if `acceptedAt` is set.
export class InvitationAlreadyAccepted extends Schema.TaggedError<InvitationAlreadyAccepted>(
  "InvitationAlreadyAccepted",
)("InvitationAlreadyAccepted", { invitationId: InvitationId }) {}

// Aggregate invariant: accept fails if `revokedAt` is set; revoke is
// also stricter and fails AlreadyRevoked on a second call rather than
// being silently idempotent (matches the org softDelete pattern).
export class InvitationAlreadyRevoked extends Schema.TaggedError<InvitationAlreadyRevoked>(
  "InvitationAlreadyRevoked",
)("InvitationAlreadyRevoked", { invitationId: InvitationId }) {}

// Re-exposed by `accept` since the invitation can't be consumed if the
// invitee already had their accept rejected for this state — same tag
// so callers can pattern-match consistently.
export class InvitationRevoked extends Schema.TaggedError<InvitationRevoked>("InvitationRevoked")(
  "InvitationRevoked",
  { invitationId: InvitationId },
) {}
