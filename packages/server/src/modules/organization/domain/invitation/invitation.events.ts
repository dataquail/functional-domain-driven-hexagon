import * as Schema from "effect/Schema";

import * as Event from "@/platform/ddd/contracts/domain-event.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/domain-event.js";
import { InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

export const InvitationIssued = Event.make("InvitationIssued", {
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

export const InvitationAccepted = Event.make("InvitationAccepted", {
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

export const InvitationRevoked = Event.make("InvitationRevoked", {
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

// Emitted when an open invitation is re-issued (resend, or invite-again
// for an email that already has an open invite): a fresh token + expiry
// replace the old ones, so the previous accept link stops working.
export const InvitationReissued = Event.make("InvitationReissued", {
  invitationId: InvitationId,
  organizationId: OrganizationId,
  inviteeEmail: Schema.String,
});
export type InvitationReissued = typeof InvitationReissued.Type;

export const invitationReissuedSpanAttributes: SpanAttributesExtractor<InvitationReissued> = (
  event,
) => ({
  "invitation.id": event.invitationId,
  "organization.id": event.organizationId,
});

export type InvitationEvent =
  | InvitationIssued
  | InvitationAccepted
  | InvitationRevoked
  | InvitationReissued;
