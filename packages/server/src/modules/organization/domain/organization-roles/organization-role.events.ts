import * as Event from "@/globals/application/ddd/domain-event.ts";
import { type SpanAttributesExtractor } from "@/globals/application/ddd/domain-event.ts";
import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.ts";
import { UserId } from "@/globals/application/ddd/ids/user-id.ts";

import { OrganizationRoleValueObject } from "./organization-role.value-object.ts";

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
