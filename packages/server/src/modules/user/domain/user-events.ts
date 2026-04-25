import { UserId } from "@org/contracts/EntityIds";
import * as Schema from "effect/Schema";
import { UserRole } from "./user-role.js";
import { Address } from "./value-objects/address.js";

export const UserCreated = Schema.TaggedStruct("UserCreated", {
  userId: UserId,
  email: Schema.String,
  address: Address,
});
export type UserCreated = typeof UserCreated.Type;

export const UserDeleted = Schema.TaggedStruct("UserDeleted", {
  userId: UserId,
});
export type UserDeleted = typeof UserDeleted.Type;

export const UserAddressUpdated = Schema.TaggedStruct("UserAddressUpdated", {
  userId: UserId,
  country: Schema.String,
  street: Schema.String,
  postalCode: Schema.String,
});
export type UserAddressUpdated = typeof UserAddressUpdated.Type;

export const UserRoleChanged = Schema.TaggedStruct("UserRoleChanged", {
  userId: UserId,
  oldRole: UserRole,
  newRole: UserRole,
});
export type UserRoleChanged = typeof UserRoleChanged.Type;

export type UserEvent = UserCreated | UserDeleted | UserAddressUpdated | UserRoleChanged;
