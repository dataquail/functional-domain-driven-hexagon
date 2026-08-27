import * as crypto from "node:crypto";

import { withUnitOfWork } from "@effect-server-utils/unit-of-work";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { type ResendInvitationPayload } from "@/modules/organization/commands/resend-invitation.command.js";
import { InvitationNotFound } from "@/modules/organization/domain/invitation/invitation.errors.js";
import { InvitationRepository } from "@/modules/organization/domain/invitation/invitation.repository.js";
import { InvitationRootOps } from "@/modules/organization/domain/invitation/invitation.root-ops.js";
import { InvitationSpecifications } from "@/modules/organization/domain/invitation/invitation.specification.js";
import { DomainEventBus } from "@/platform/ddd/event-bus.js";

// Resend = re-issue: rotate the token and reset the expiry on an open
// invitation. The previous link stops working. Reissue refuses
// accepted/revoked invitations (the aggregate enforces it), which the
// endpoint maps to 410 Gone — same shape as revoke.
//
// Re-sending the email is a reaction to `InvitationReissued`, not a step here.
export const resendInvitationHandler = Effect.fn("resendInvitationHandler")(function* (
  cmd: ResendInvitationPayload,
) {
  const repo = yield* InvitationRepository;
  const bus = yield* DomainEventBus;
  const now = yield* DateTime.now;
  // Fresh opaque bearer credential (256 bits, base64url). Randomness is
  // impure, so it stays in the command (the shell), never the domain.
  const token = yield* Effect.sync(() => crypto.randomBytes(32).toString("base64url"));
  const expiresAt = DateTime.add(now, { seconds: cmd.ttlSeconds });

  const invitation = yield* repo.findOne(InvitationSpecifications.withId(cmd.invitationId));
  if (invitation === null) {
    return yield* new InvitationNotFound({ invitationId: cmd.invitationId });
  }
  const result = yield* Effect.fromResult(
    InvitationRootOps.reissue(invitation, { token, expiresAt, now }),
  );
  yield* repo.updateOne(result.invitation);
  yield* bus.dispatch(result.events);
  yield* Effect.annotateCurrentSpan("invitation.id", cmd.invitationId);
}, withUnitOfWork);
