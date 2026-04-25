import { UserId } from "@/modules/user/domain/user-id.js";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Either from "effect/Either";
import * as Schema from "effect/Schema";
import { type UserEvent } from "./user-events.js";
import * as User from "./user.js";
import { Address } from "./value-objects/address.js";

const id = UserId.make("11111111-1111-1111-1111-111111111111");
const now = DateTime.unsafeMake(new Date("2025-01-01T00:00:00Z"));
const later = DateTime.unsafeMake(new Date("2025-02-01T00:00:00Z"));

const address = Address.make({
  country: "USA",
  street: "123 Main St",
  postalCode: "12345",
});

const seedUser = () => User.create({ id, email: "alice@example.com", address, now }).user;

const expectEvent = <T extends UserEvent["_tag"]>(
  events: ReadonlyArray<UserEvent>,
  tag: T,
): Extract<UserEvent, { _tag: T }> => {
  const event = events[0];
  if (event?._tag !== tag) {
    throw new Error(`expected ${tag}, got ${String(event?._tag)}`);
  }
  return event as Extract<UserEvent, { _tag: T }>;
};

describe("Address", () => {
  it("accepts valid lengths", () => {
    const result = Schema.decodeUnknownEither(Address)({
      country: "USA",
      street: "123 Main St",
      postalCode: "12345",
    });
    deepStrictEqual(Either.isRight(result), true);
  });

  it("rejects country shorter than 2 chars", () => {
    const result = Schema.decodeUnknownEither(Address)({
      country: "X",
      street: "123 Main St",
      postalCode: "12345",
    });
    deepStrictEqual(Either.isLeft(result), true);
  });

  it("rejects country longer than 50 chars", () => {
    const result = Schema.decodeUnknownEither(Address)({
      country: "X".repeat(51),
      street: "123 Main St",
      postalCode: "12345",
    });
    deepStrictEqual(Either.isLeft(result), true);
  });

  it("rejects street shorter than 2 chars", () => {
    const result = Schema.decodeUnknownEither(Address)({
      country: "USA",
      street: "X",
      postalCode: "12345",
    });
    deepStrictEqual(Either.isLeft(result), true);
  });

  it("rejects postalCode longer than 10 chars", () => {
    const result = Schema.decodeUnknownEither(Address)({
      country: "USA",
      street: "123 Main St",
      postalCode: "12345678901",
    });
    deepStrictEqual(Either.isLeft(result), true);
  });
});

describe("User.create", () => {
  it("sets id, email, and address from input", () => {
    const { user } = User.create({ id, email: "alice@example.com", address, now });
    deepStrictEqual(user.id, id);
    deepStrictEqual(user.email, "alice@example.com");
    deepStrictEqual(user.address.country, "USA");
    deepStrictEqual(user.address.street, "123 Main St");
    deepStrictEqual(user.address.postalCode, "12345");
  });

  it("defaults role to 'guest'", () => {
    const { user } = User.create({ id, email: "alice@example.com", address, now });
    deepStrictEqual(user.role, "guest");
  });

  it("sets createdAt and updatedAt to the provided time", () => {
    const { user } = User.create({ id, email: "alice@example.com", address, now });
    deepStrictEqual(user.createdAt, now);
    deepStrictEqual(user.updatedAt, now);
  });

  it("emits a single UserCreated event with userId, email, address", () => {
    const { events } = User.create({ id, email: "alice@example.com", address, now });
    deepStrictEqual(events.length, 1);
    const event = expectEvent(events, "UserCreated");
    deepStrictEqual(event.userId, id);
    deepStrictEqual(event.email, "alice@example.com");
    deepStrictEqual(event.address.country, "USA");
  });
});

describe("User.markDeleted", () => {
  it("leaves user state unchanged", () => {
    const original = seedUser();
    const { user } = User.markDeleted(original);
    deepStrictEqual(user.id, original.id);
    deepStrictEqual(user.email, original.email);
    deepStrictEqual(user.role, original.role);
    deepStrictEqual(user.updatedAt, original.updatedAt);
  });

  it("emits a single UserDeleted event", () => {
    const { events } = User.markDeleted(seedUser());
    deepStrictEqual(events.length, 1);
    expectEvent(events, "UserDeleted");
  });
});

describe("User.makeAdmin", () => {
  it("changes role to 'admin'", () => {
    const { user } = User.makeAdmin(seedUser(), { now: later });
    deepStrictEqual(user.role, "admin");
  });

  it("updates updatedAt but preserves createdAt", () => {
    const { user } = User.makeAdmin(seedUser(), { now: later });
    deepStrictEqual(user.updatedAt, later);
    deepStrictEqual(user.createdAt, now);
  });

  it("emits a UserRoleChanged event with prior role as oldRole", () => {
    const { events } = User.makeAdmin(seedUser(), { now: later });
    deepStrictEqual(events.length, 1);
    const event = expectEvent(events, "UserRoleChanged");
    deepStrictEqual(event.oldRole, "guest");
    deepStrictEqual(event.newRole, "admin");
  });
});

describe("User.makeModerator", () => {
  it("changes role to 'moderator' and emits UserRoleChanged", () => {
    const { events, user } = User.makeModerator(seedUser(), { now: later });
    deepStrictEqual(user.role, "moderator");
    const event = expectEvent(events, "UserRoleChanged");
    deepStrictEqual(event.newRole, "moderator");
  });
});

describe("User.updateAddress", () => {
  it("replaces all address fields when all provided", () => {
    const { user } = User.updateAddress(seedUser(), {
      country: "Canada",
      street: "456 Maple Ave",
      postalCode: "K1A0B1",
      now: later,
    });
    deepStrictEqual(user.address.country, "Canada");
    deepStrictEqual(user.address.street, "456 Maple Ave");
    deepStrictEqual(user.address.postalCode, "K1A0B1");
  });

  it("merges partial updates with the existing address", () => {
    const { user } = User.updateAddress(seedUser(), {
      country: "Canada",
      now: later,
    });
    deepStrictEqual(user.address.country, "Canada");
    deepStrictEqual(user.address.street, "123 Main St");
    deepStrictEqual(user.address.postalCode, "12345");
  });

  it("updates updatedAt but preserves createdAt", () => {
    const { user } = User.updateAddress(seedUser(), { country: "Canada", now: later });
    deepStrictEqual(user.updatedAt, later);
    deepStrictEqual(user.createdAt, now);
  });

  it("emits UserAddressUpdated with the merged address fields", () => {
    const { events } = User.updateAddress(seedUser(), { country: "Canada", now: later });
    deepStrictEqual(events.length, 1);
    const event = expectEvent(events, "UserAddressUpdated");
    deepStrictEqual(event.country, "Canada");
    deepStrictEqual(event.street, "123 Main St");
    deepStrictEqual(event.postalCode, "12345");
  });
});
