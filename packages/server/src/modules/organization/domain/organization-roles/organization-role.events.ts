import * as Event from "@/platform/ddd/contracts/domain-event.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/domain-event.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { OrganizationRoleValueObject } from "./organization-role.value-object.js";

export const OrganizationRoleGranted = Event.make("OrganizationRoleGranted", {
  userId: UserId,
  organizationId: OrganizationId,
  role: OrganizationRoleValueObject,
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

export const OrganizationRoleRevoked = Event.make("OrganizationRoleRevoked", {
  userId: UserId,
  organizationId: OrganizationId,
  role: OrganizationRoleValueObject,
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
