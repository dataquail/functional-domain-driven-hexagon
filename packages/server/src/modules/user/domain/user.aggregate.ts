import type * as DateTime from "effect/DateTime";
import * as Schema from "effect/Schema";

import { UserId } from "@/platform/ids/user-id.js";

import { UserAddressUpdated, UserCreated, UserDeleted, type UserEvent } from "./user-events.js";
import { Address } from "./value-objects/address.js";

export class User extends Schema.Class<User>("User")({
  id: UserId,
  email: Schema.String,
  // Nullable: a user provisioned just-in-time on first OIDC sign-in has no
  // address yet (only email + Zitadel subject are known). It's filled in
  // later via `updateAddress`.
  address: Schema.NullOr(Address),
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
  readonly address: Address | null;
  readonly now: DateTime.Utc;
};

export const create = (input: CreateInput): Result => {
  const user = User.make({
    id: input.id,
    email: input.email,
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

export type UpdateAddressInput = {
  readonly country?: string;
  readonly postalCode?: string;
  readonly street?: string;
  readonly now: DateTime.Utc;
};

export const updateAddress = (user: User, input: UpdateAddressInput): Result => {
  const newAddress = Address.make({
    country: input.country ?? user.address?.country ?? "",
    postalCode: input.postalCode ?? user.address?.postalCode ?? "",
    street: input.street ?? user.address?.street ?? "",
  });
  return {
    user: User.make({
      id: user.id,
      email: user.email,
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
