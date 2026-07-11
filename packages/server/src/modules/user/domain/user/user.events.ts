import * as Schema from "effect/Schema";

import { DomainEvent } from "@/platform/ddd/contracts/domain-event.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { UserId } from "@/platform/ids/user-id.js";

import { AddressValueObject } from "./value-objects/address.value-object.js";

export const UserCreated = DomainEvent("UserCreated", {
  userId: UserId,
  email: Schema.String,
  // Nullable: a JIT-provisioned user is created without an address.
  address: Schema.NullOr(AddressValueObject),
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

export type UserEvent = UserCreated | UserDeleted | UserAddressUpdated;
