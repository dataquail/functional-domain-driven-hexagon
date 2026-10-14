import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Arr from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { UserId } from "@/globals/application/ddd/ids/user-id.js";

import { type UserEvent } from "./user.events.js";
import { type UserRoot } from "./user.root.js";
import { UserRootOps } from "./user.root-ops.js";
import { AddressValueObject } from "./value-objects/address.value-object.js";

const id = UserId.make("11111111-1111-1111-1111-111111111111");
const now = DateTime.makeUnsafe("2025-01-01T00:00:00Z");
const later = DateTime.makeUnsafe("2025-02-01T00:00:00Z");

const address = Option.some(
  AddressValueObject.make({
    country: "USA",
    street: "123 Main St",
    postalCode: "12345",
  }),
);

const seedUser = () => UserRootOps.create({ id, email: "alice@example.com", address, now }).user;

const requireAddress = (user: UserRoot): AddressValueObject => Option.getOrThrow(user.address);

const expectEvent = <T extends UserEvent["_tag"]>(
  events: ReadonlyArray<UserEvent>,
  tag: T,
): Extract<UserEvent, { _tag: T }> =>
  Arr.head(events).pipe(
    Option.filter((event): event is Extract<UserEvent, { _tag: T }> =>
      Predicate.isTagged(event, tag),
    ),
    Option.getOrThrow,
  );

describe("AddressValueObject", () => {
  it("accepts valid lengths", () => {
    const result = Schema.decodeResult(AddressValueObject)({
      country: "USA",
      street: "123 Main St",
      postalCode: "12345",
    });

    deepStrictEqual(Result.isSuccess(result), true);
  });

  it("rejects country shorter than 2 chars", () => {
    const result = Schema.decodeResult(AddressValueObject)({
      country: "X",
      street: "123 Main St",
      postalCode: "12345",
    });

    deepStrictEqual(Result.isFailure(result), true);
  });

  it("rejects country longer than 50 chars", () => {
    const result = Schema.decodeResult(AddressValueObject)({
      country: "X".repeat(51),
      street: "123 Main St",
      postalCode: "12345",
    });

    deepStrictEqual(Result.isFailure(result), true);
  });

  it("rejects street shorter than 2 chars", () => {
    const result = Schema.decodeResult(AddressValueObject)({
      country: "USA",
      street: "X",
      postalCode: "12345",
    });

    deepStrictEqual(Result.isFailure(result), true);
  });

  it("rejects postalCode longer than 10 chars", () => {
    const result = Schema.decodeResult(AddressValueObject)({
      country: "USA",
      street: "123 Main St",
      postalCode: "12345678901",
    });

    deepStrictEqual(Result.isFailure(result), true);
  });
});

describe("UserRootOps.create", () => {
  it("sets id, email, and address from input", () => {
    const { user } = UserRootOps.create({ id, email: "alice@example.com", address, now });
    deepStrictEqual(user.id, id);
    deepStrictEqual(user.email, "alice@example.com");
    const addr = requireAddress(user);
    deepStrictEqual(addr.country, "USA");
    deepStrictEqual(addr.street, "123 Main St");
    deepStrictEqual(addr.postalCode, "12345");
  });

  it("creates an address-less user when address is null (JIT provisioning)", () => {
    const { events, user } = UserRootOps.create({
      id,
      email: "jit@example.com",
      address: Option.none(),
      now,
    });

    assertNone(user.address);
    const event = expectEvent(events, "UserCreated");
    assertNone(event.address);
  });

  it("sets createdAt and updatedAt to the provided time", () => {
    const { user } = UserRootOps.create({ id, email: "alice@example.com", address, now });
    deepStrictEqual(user.createdAt, now);
    deepStrictEqual(user.updatedAt, now);
  });

  it("emits a single UserCreated event with userId, email, address", () => {
    const { events } = UserRootOps.create({ id, email: "alice@example.com", address, now });
    deepStrictEqual(events.length, 1);
    const event = expectEvent(events, "UserCreated");
    deepStrictEqual(event.userId, id);
    deepStrictEqual(event.email, "alice@example.com");
    deepStrictEqual(
      Option.map(event.address, (eventAddress) => eventAddress.country),
      Option.some("USA"),
    );
  });
});

describe("UserRootOps.markDeleted", () => {
  it("leaves user state unchanged", () => {
    const original = seedUser();
    const { user } = UserRootOps.markDeleted(original);
    deepStrictEqual(user.id, original.id);
    deepStrictEqual(user.email, original.email);
    deepStrictEqual(user.updatedAt, original.updatedAt);
  });

  it("emits a single UserDeleted event", () => {
    const { events } = UserRootOps.markDeleted(seedUser());
    deepStrictEqual(events.length, 1);
    expectEvent(events, "UserDeleted");
  });
});

describe("UserRootOps.updateAddress", () => {
  it("replaces all address fields when all provided", () => {
    const { user } = UserRootOps.updateAddress(seedUser(), {
      country: "Canada",
      street: "456 Maple Ave",
      postalCode: "K1A0B1",
      now: later,
    });

    const addr = requireAddress(user);
    deepStrictEqual(addr.country, "Canada");
    deepStrictEqual(addr.street, "456 Maple Ave");
    deepStrictEqual(addr.postalCode, "K1A0B1");
  });

  it("merges partial updates with the existing address", () => {
    const { user } = UserRootOps.updateAddress(seedUser(), {
      country: "Canada",
      now: later,
    });

    const addr = requireAddress(user);
    deepStrictEqual(addr.country, "Canada");
    deepStrictEqual(addr.street, "123 Main St");
    deepStrictEqual(addr.postalCode, "12345");
  });

  it("updates updatedAt but preserves createdAt", () => {
    const { user } = UserRootOps.updateAddress(seedUser(), { country: "Canada", now: later });
    deepStrictEqual(user.updatedAt, later);
    deepStrictEqual(user.createdAt, now);
  });

  it("emits UserAddressUpdated with the merged address fields", () => {
    const { events } = UserRootOps.updateAddress(seedUser(), { country: "Canada", now: later });
    deepStrictEqual(events.length, 1);
    const event = expectEvent(events, "UserAddressUpdated");
    deepStrictEqual(event.country, "Canada");
    deepStrictEqual(event.street, "123 Main St");
    deepStrictEqual(event.postalCode, "12345");
  });
});
