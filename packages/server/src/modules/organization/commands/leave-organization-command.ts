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

// Self-removal — same persistence shape as RemoveMember but the actor
// IS the target. Kept as a separate command so the policy layer can
// gate it differently (any member can leave; only admins can remove
// others) and so the bus span/log distinguishes the two flows.
export const LeaveOrganizationCommand = Schema.TaggedStruct("LeaveOrganizationCommand", {
  userId: UserId,
  organizationId: OrganizationId,
});
export type LeaveOrganizationCommand = typeof LeaveOrganizationCommand.Type;

export const leaveOrganizationCommandSpanAttributes: SpanAttributesExtractor<
  LeaveOrganizationCommand
> = (cmd) => ({ "user.id": cmd.userId, "organization.id": cmd.organizationId });

// Raw handler effect — `MembershipRepository` is discharged by the wrap
// in `organization-command-handlers.ts`.
export type LeaveOrganizationOutput = Effect.Effect<
  void,
  MembershipNotFound | PersistenceUnavailable,
  MembershipRepository | DomainEventBus | UnitOfWork
>;
