import * as Event from "@/globals/application/ddd/domain-event";
import { type SpanAttributesExtractor } from "@/globals/application/ddd/domain-event";
import { OrganizationId } from "@/globals/application/ddd/ids/organization-id";
import { UserId } from "@/globals/application/ddd/ids/user-id";

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
