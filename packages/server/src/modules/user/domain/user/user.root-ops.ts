import type * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";

import { type UserId } from "@/globals/application/ddd/ids/user-id.ts";

import { UserAddressUpdated, UserCreated, UserDeleted, type UserEvent } from "./user.events.ts";
import { UserRoot } from "./user.root.ts";
import { AddressValueObject } from "./value-objects/address.value-object.ts";

export type Result = {
  readonly user: UserRoot;
  readonly events: ReadonlyArray<UserEvent>;
};

export type CreateInput = {
  readonly id: UserId;
  readonly email: string;
  readonly address: Option.Option<AddressValueObject>;
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

const currentAddressField = (user: UserRoot, field: keyof AddressValueObject): string =>
  Option.match(user.address, { onNone: () => "", onSome: (address) => address[field] });

const updateAddress = (user: UserRoot, input: UpdateAddressInput): Result => {
  const newAddress = AddressValueObject.make({
    country: input.country ?? currentAddressField(user, "country"),
    postalCode: input.postalCode ?? currentAddressField(user, "postalCode"),
    street: input.street ?? currentAddressField(user, "street"),
  });

  return {
    user: UserRoot.make({
      id: user.id,
      email: user.email,
      address: Option.some(newAddress),
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
