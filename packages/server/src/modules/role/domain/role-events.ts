import { DomainEvent } from "@/platform/ddd/contracts/domain-event.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { UserId } from "@/platform/ids/user-id.js";

import { Role } from "./role.js";

export const RoleGranted = DomainEvent("RoleGranted", {
  userId: UserId,
  role: Role,
});
export type RoleGranted = typeof RoleGranted.Type;

export const roleGrantedSpanAttributes: SpanAttributesExtractor<RoleGranted> = (event) => ({
  "user.id": event.userId,
  "role.name": event.role,
});

export const RoleRevoked = DomainEvent("RoleRevoked", {
  userId: UserId,
  role: Role,
});
export type RoleRevoked = typeof RoleRevoked.Type;

export const roleRevokedSpanAttributes: SpanAttributesExtractor<RoleRevoked> = (event) => ({
  "user.id": event.userId,
  "role.name": event.role,
});

export type RoleEvent = RoleGranted | RoleRevoked;
