import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import {
  type InvitationAlreadyAccepted,
  type InvitationAlreadyRevoked,
  type InvitationNotFound,
} from "@/modules/organization/domain/invitation.errors.js";
import { type InvitationRepository } from "@/modules/organization/domain/ports/repositories/invitation.repository.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { type DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { type UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";
import { InvitationId } from "@/platform/ids/invitation-id.js";
import { UserId } from "@/platform/ids/user-id.js";

export const RevokeInvitationCommand = Schema.TaggedStruct("RevokeInvitationCommand", {
  invitationId: InvitationId,
  actorUserId: UserId,
});
export type RevokeInvitationCommand = typeof RevokeInvitationCommand.Type;

export const revokeInvitationCommandSpanAttributes: SpanAttributesExtractor<
  RevokeInvitationCommand
> = (cmd) => ({ "invitation.id": cmd.invitationId, "actor.user.id": cmd.actorUserId });

// Raw handler effect — `InvitationRepository` is discharged by the wrap
// in `organization-command-handlers.ts`.
export type RevokeInvitationOutput = Effect.Effect<
  void,
  | InvitationNotFound
  | InvitationAlreadyAccepted
  | InvitationAlreadyRevoked
  | PersistenceUnavailable,
  InvitationRepository | DomainEventBus | UnitOfWork
>;
