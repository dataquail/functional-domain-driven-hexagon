import * as Schema from "effect/Schema";

import { DomainEvent } from "@/platform/ddd/contracts/domain-event.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

export const InvitationIssued = DomainEvent("InvitationIssued", {
  invitationId: InvitationId,
  organizationId: OrganizationId,
  inviteeEmail: Schema.String,
});
export type InvitationIssued = typeof InvitationIssued.Type;

export const invitationIssuedSpanAttributes: SpanAttributesExtractor<InvitationIssued> = (
  event,
) => ({
  "invitation.id": event.invitationId,
  "organization.id": event.organizationId,
});

export const InvitationAccepted = DomainEvent("InvitationAccepted", {
  invitationId: InvitationId,
  organizationId: OrganizationId,
  userId: UserId,
});
export type InvitationAccepted = typeof InvitationAccepted.Type;

export const invitationAcceptedSpanAttributes: SpanAttributesExtractor<InvitationAccepted> = (
  event,
) => ({
  "invitation.id": event.invitationId,
  "organization.id": event.organizationId,
  "user.id": event.userId,
});

export const InvitationRevoked = DomainEvent("InvitationRevoked", {
  invitationId: InvitationId,
  organizationId: OrganizationId,
});
export type InvitationRevoked = typeof InvitationRevoked.Type;

export const invitationRevokedSpanAttributes: SpanAttributesExtractor<InvitationRevoked> = (
  event,
) => ({
  "invitation.id": event.invitationId,
  "organization.id": event.organizationId,
});

export type InvitationEvent = InvitationIssued | InvitationAccepted | InvitationRevoked;
