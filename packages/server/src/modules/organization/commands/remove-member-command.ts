import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type MembershipNotFound } from "@/modules/organization/domain/membership-errors.js";
import { type MembershipRepository } from "@/modules/organization/domain/membership-repository.js";
import { type DomainEventBus } from "@/platform/ddd/domain-event-bus.js";
import { type PersistenceUnavailable } from "@/platform/ddd/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/span-attributable.js";
import { type UnitOfWork } from "@/platform/ddd/unit-of-work.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

// Removes another user from an org. `actorUserId` is recorded for
// span attributes and (Phase 4) the policy layer's grant check; the
// handler itself doesn't enforce a "no self-removal" invariant —
// callers wanting to leave should dispatch `LeaveOrganizationCommand`,
// which is the authenticated-self path with its own policy.
export const RemoveMemberCommand = Schema.TaggedStruct("RemoveMemberCommand", {
  targetUserId: UserId,
  organizationId: OrganizationId,
  actorUserId: UserId,
});
export type RemoveMemberCommand = typeof RemoveMemberCommand.Type;

export const removeMemberCommandSpanAttributes: SpanAttributesExtractor<RemoveMemberCommand> = (
  cmd,
) => ({
  "target.user.id": cmd.targetUserId,
  "organization.id": cmd.organizationId,
  "actor.user.id": cmd.actorUserId,
});

// Raw handler effect — `MembershipRepository` is discharged by the wrap
// in `organization-command-handlers.ts`.
export type RemoveMemberOutput = Effect.Effect<
  void,
  MembershipNotFound | PersistenceUnavailable,
  MembershipRepository | DomainEventBus | UnitOfWork
>;
