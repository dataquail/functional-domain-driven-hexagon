import { DomainEvent } from "@/platform/domain-event.js";
import { type SpanAttributesExtractor } from "@/platform/span-attributable.js";
import * as Schema from "effect/Schema";
import { UserId } from "./user-id.js";
import { UserRole } from "./user-role.js";
import { Address } from "./value-objects/address.js";

export const UserCreated = DomainEvent("UserCreated", {
  userId: UserId,
  email: Schema.String,
  address: Address,
});
export type UserCreated = typeof UserCreated.Type;

export const userCreatedSpanAttributes: SpanAttributesExtractor<UserCreated> = (event) => ({
  "user.id": event.userId,
});

export const UserDeleted = DomainEvent("UserDeleted", {
  userId: UserId,
});
export type UserDeleted = typeof UserDeleted.Type;

export const userDeletedSpanAttributes: SpanAttributesExtractor<UserDeleted> = (event) => ({
  "user.id": event.userId,
});

export const UserAddressUpdated = DomainEvent("UserAddressUpdated", {
  userId: UserId,
  country: Schema.String,
  street: Schema.String,
  postalCode: Schema.String,
});
export type UserAddressUpdated = typeof UserAddressUpdated.Type;

export const userAddressUpdatedSpanAttributes: SpanAttributesExtractor<UserAddressUpdated> = (
  event,
) => ({ "user.id": event.userId });

export const UserRoleChanged = DomainEvent("UserRoleChanged", {
  userId: UserId,
  oldRole: UserRole,
  newRole: UserRole,
});
export type UserRoleChanged = typeof UserRoleChanged.Type;

export const userRoleChangedSpanAttributes: SpanAttributesExtractor<UserRoleChanged> = (event) => ({
  "user.id": event.userId,
  "user.role.old": event.oldRole,
  "user.role.new": event.newRole,
});

export type UserEvent = UserCreated | UserDeleted | UserAddressUpdated | UserRoleChanged;
