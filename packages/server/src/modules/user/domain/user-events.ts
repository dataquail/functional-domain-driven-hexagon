import * as Schema from "effect/Schema";

import { DomainEvent } from "@/platform/ddd/domain-event.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/span-attributable.js";
import { UserId } from "@/platform/ids/user-id.js";

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

export const UserPromotedToSuperAdmin = DomainEvent("UserPromotedToSuperAdmin", {
  userId: UserId,
});
export type UserPromotedToSuperAdmin = typeof UserPromotedToSuperAdmin.Type;

export const userPromotedToSuperAdminSpanAttributes: SpanAttributesExtractor<
  UserPromotedToSuperAdmin
> = (event) => ({ "user.id": event.userId });

export const UserDemotedFromSuperAdmin = DomainEvent("UserDemotedFromSuperAdmin", {
  userId: UserId,
});
export type UserDemotedFromSuperAdmin = typeof UserDemotedFromSuperAdmin.Type;

export const userDemotedFromSuperAdminSpanAttributes: SpanAttributesExtractor<
  UserDemotedFromSuperAdmin
> = (event) => ({ "user.id": event.userId });

export type UserEvent =
  | UserCreated
  | UserDeleted
  | UserAddressUpdated
  | UserPromotedToSuperAdmin
  | UserDemotedFromSuperAdmin;
