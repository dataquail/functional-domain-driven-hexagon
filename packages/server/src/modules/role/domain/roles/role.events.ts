import * as Event from "@/globals/application/ddd/domain-event.ts";
import { type SpanAttributesExtractor } from "@/globals/application/ddd/domain-event.ts";
import { UserId } from "@/globals/application/ddd/ids/user-id.ts";

import { RoleValueObject } from "./role.value-object.ts";

export const RoleGranted = Event.make("RoleGranted", {
  userId: UserId,
  role: RoleValueObject,
});

export type RoleGranted = typeof RoleGranted.Type;

export const roleGrantedSpanAttributes: SpanAttributesExtractor<RoleGranted> = (event) => ({
  "user.id": event.userId,
  "role.name": event.role,
});

export const RoleRevoked = Event.make("RoleRevoked", {
  userId: UserId,
  role: RoleValueObject,
});

export type RoleRevoked = typeof RoleRevoked.Type;

export const roleRevokedSpanAttributes: SpanAttributesExtractor<RoleRevoked> = (event) => ({
  "user.id": event.userId,
  "role.name": event.role,
});

export type RoleEvent = RoleGranted | RoleRevoked;
