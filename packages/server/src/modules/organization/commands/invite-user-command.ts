import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type InvitationRepository } from "@/modules/organization/domain/ports/repositories/invitation-repository.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { type DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { type UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";
import { type InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import { type Mailer } from "@/platform/notifications/mailer.js";

export const InviteUserCommand = Schema.TaggedStruct("InviteUserCommand", {
  organizationId: OrganizationId,
  inviteeEmail: Schema.String.pipe(Schema.minLength(3), Schema.maxLength(320)),
  ttlSeconds: Schema.Number,
  actorUserId: UserId,
});
export type InviteUserCommand = typeof InviteUserCommand.Type;

// `inviteeEmail` is intentionally not in the span — it's PII. The
// generated invitation id is annotated from inside the handler.
export const inviteUserCommandSpanAttributes: SpanAttributesExtractor<InviteUserCommand> = (
  cmd,
) => ({ "organization.id": cmd.organizationId, "actor.user.id": cmd.actorUserId });

// Raw handler effect — `InvitationRepository` and `Mailer` are
// discharged by the wrap in `organization-command-handlers.ts`; the
// bus-registered output type lives there.
export type InviteUserOutput = Effect.Effect<
  InvitationId,
  PersistenceUnavailable,
  InvitationRepository | DomainEventBus | UnitOfWork | Mailer
>;
