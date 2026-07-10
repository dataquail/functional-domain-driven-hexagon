import type * as DateTime from "effect/DateTime";

import { type UserId } from "@/platform/ids/user-id.js";

import { UserAddressUpdated, UserCreated, UserDeleted, type UserEvent } from "./user.events.js";
import { UserRoot } from "./user.root.js";
import { AddressValueObject } from "./value-objects/address.value-object.js";

export type Result = {
  readonly user: UserRoot;
  readonly events: ReadonlyArray<UserEvent>;
};

export type CreateInput = {
  readonly id: UserId;
  readonly email: string;
  readonly address: AddressValueObject | null;
  readonly now: DateTime.Utc;
};

const create = (input: CreateInput): Result => {
  const user = UserRoot.make({
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

const markDeleted = (user: UserRoot): Result => ({
  user,
  events: [UserDeleted.make({ userId: user.id })],
});

export type UpdateAddressInput = {
  readonly country?: string;
  readonly postalCode?: string;
  readonly street?: string;
  readonly now: DateTime.Utc;
};

const updateAddress = (user: UserRoot, input: UpdateAddressInput): Result => {
  const newAddress = AddressValueObject.make({
    country: input.country ?? user.address?.country ?? "",
    postalCode: input.postalCode ?? user.address?.postalCode ?? "",
    street: input.street ?? user.address?.street ?? "",
  });
  return {
    user: UserRoot.make({
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

export const UserRootOps = { create, markDeleted, updateAddress } as const;
