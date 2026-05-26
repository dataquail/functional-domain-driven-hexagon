import { DomainEvent } from "@/platform/ddd/domain-event.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/span-attributable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { OrganizationRole } from "./organization-role.js";

export const OrganizationRoleGranted = DomainEvent("OrganizationRoleGranted", {
  userId: UserId,
  organizationId: OrganizationId,
  role: OrganizationRole,
  issuedBy: UserId,
});
export type OrganizationRoleGranted = typeof OrganizationRoleGranted.Type;

export const organizationRoleGrantedSpanAttributes: SpanAttributesExtractor<
  OrganizationRoleGranted
> = (event) => ({
  "user.id": event.userId,
  "organization.id": event.organizationId,
  "organization.role": event.role,
  "issued.by.user.id": event.issuedBy,
});

export const OrganizationRoleRevoked = DomainEvent("OrganizationRoleRevoked", {
  userId: UserId,
  organizationId: OrganizationId,
  role: OrganizationRole,
});
export type OrganizationRoleRevoked = typeof OrganizationRoleRevoked.Type;

export const organizationRoleRevokedSpanAttributes: SpanAttributesExtractor<
  OrganizationRoleRevoked
> = (event) => ({
  "user.id": event.userId,
  "organization.id": event.organizationId,
  "organization.role": event.role,
});

export type OrganizationRoleEvent = OrganizationRoleGranted | OrganizationRoleRevoked;
