import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import {
  type InvitationAlreadyAccepted,
  type InvitationExpired,
  type InvitationRevoked,
  type InvitationTokenNotFound,
} from "@/modules/organization/domain/invitation-errors.js";
import { type InvitationRepository } from "@/modules/organization/domain/ports/repositories/invitation-repository.js";
import { type MembershipRepository } from "@/modules/organization/domain/ports/repositories/membership-repository.js";
import { type DomainEventBus } from "@/platform/ddd/domain-event-bus.js";
import { type PersistenceUnavailable } from "@/platform/ddd/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/span-attributable.js";
import { type UnitOfWork } from "@/platform/ddd/unit-of-work.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

export const AcceptInvitationCommand = Schema.TaggedStruct("AcceptInvitationCommand", {
  token: Schema.String,
  userId: UserId,
});
export type AcceptInvitationCommand = typeof AcceptInvitationCommand.Type;

// Token deliberately omitted from the span — it's a bearer credential.
// The invitation id is annotated inside the handler once resolved.
export const acceptInvitationCommandSpanAttributes: SpanAttributesExtractor<
  AcceptInvitationCommand
> = (cmd) => ({ "user.id": cmd.userId });

// Raw handler effect — repositories are discharged by the wrap in
// `organization-command-handlers.ts`. Returns the organizationId so the
// HTTP endpoint can redirect the invitee into their new org.
export type AcceptInvitationOutput = Effect.Effect<
  OrganizationId,
  | InvitationTokenNotFound
  | InvitationAlreadyAccepted
  | InvitationRevoked
  | InvitationExpired
  | PersistenceUnavailable,
  InvitationRepository | MembershipRepository | DomainEventBus | UnitOfWork
>;
