import * as Event from "@/platform/ddd/contracts/domain-event.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/domain-event.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

export const MembershipCreated = Event.make("MembershipCreated", {
  userId: UserId,
  organizationId: OrganizationId,
});
export type MembershipCreated = typeof MembershipCreated.Type;

export const membershipCreatedSpanAttributes: SpanAttributesExtractor<MembershipCreated> = (
  event,
) => ({
  "user.id": event.userId,
  "organization.id": event.organizationId,
});

export const MembershipRevoked = Event.make("MembershipRevoked", {
  userId: UserId,
  organizationId: OrganizationId,
});
export type MembershipRevoked = typeof MembershipRevoked.Type;

export const membershipRevokedSpanAttributes: SpanAttributesExtractor<MembershipRevoked> = (
  event,
) => ({
  "user.id": event.userId,
  "organization.id": event.organizationId,
});

export type MembershipEvent = MembershipCreated | MembershipRevoked;
