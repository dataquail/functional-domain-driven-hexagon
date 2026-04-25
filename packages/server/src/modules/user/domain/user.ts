import { UserId } from "@org/contracts/EntityIds";
import type * as DateTime from "effect/DateTime";
import * as Schema from "effect/Schema";
import {
  UserAddressUpdated,
  UserCreated,
  UserDeleted,
  UserRoleChanged,
  type UserEvent,
} from "./user-events.js";
import { UserRole } from "./user-role.js";
import { Address } from "./value-objects/address.js";

export class User extends Schema.Class<User>("User")({
  id: UserId,
  email: Schema.String,
  role: UserRole,
  address: Address,
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
}) {}

export type Result = {
  readonly user: User;
  readonly events: ReadonlyArray<UserEvent>;
};

export type CreateInput = {
  readonly id: UserId;
  readonly email: string;
  readonly address: Address;
  readonly now: DateTime.Utc;
};

export const create = (input: CreateInput): Result => {
  const user = User.make({
    id: input.id,
    email: input.email,
    role: "guest",
    address: input.address,
    createdAt: input.now,
    updatedAt: input.now,
  });
  return {
    user,
    events: [
      UserCreated.make({
        userId: user.id,
        email: user.email,
        address: user.address,
      }),
    ],
  };
};

export const markDeleted = (user: User): Result => ({
  user,
  events: [UserDeleted.make({ userId: user.id })],
});

export type RoleChangeInput = { readonly now: DateTime.Utc };

const changeRole = (user: User, newRole: UserRole, input: RoleChangeInput): Result => ({
  user: User.make({
    id: user.id,
    email: user.email,
    role: newRole,
    address: user.address,
    createdAt: user.createdAt,
    updatedAt: input.now,
  }),
  events: [UserRoleChanged.make({ userId: user.id, oldRole: user.role, newRole })],
});

export const makeAdmin = (user: User, input: RoleChangeInput): Result =>
  changeRole(user, "admin", input);

export const makeModerator = (user: User, input: RoleChangeInput): Result =>
  changeRole(user, "moderator", input);

export type UpdateAddressInput = {
  readonly country?: string;
  readonly postalCode?: string;
  readonly street?: string;
  readonly now: DateTime.Utc;
};

export const updateAddress = (user: User, input: UpdateAddressInput): Result => {
  const newAddress = Address.make({
    country: input.country ?? user.address.country,
    postalCode: input.postalCode ?? user.address.postalCode,
    street: input.street ?? user.address.street,
  });
  return {
    user: User.make({
      id: user.id,
      email: user.email,
      role: user.role,
      address: newAddress,
      createdAt: user.createdAt,
      updatedAt: input.now,
    }),
    events: [
      UserAddressUpdated.make({
        userId: user.id,
        country: newAddress.country,
        postalCode: newAddress.postalCode,
        street: newAddress.street,
      }),
    ],
  };
};
