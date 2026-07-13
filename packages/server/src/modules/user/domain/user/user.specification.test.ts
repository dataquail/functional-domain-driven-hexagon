import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";

import { UserId } from "@/platform/ids/user-id.js";

import { UserRootOps } from "./user.root-ops.js";
import { UserSpecifications } from "./user.specification.js";

const aliceId = UserId.make("11111111-1111-1111-1111-111111111111");
const bobId = UserId.make("22222222-2222-2222-2222-222222222222");
const now = DateTime.makeUnsafe(new Date("2025-01-01T00:00:00Z"));

const alice = UserRootOps.create({
  id: aliceId,
  email: "alice@example.com",
  address: null,
  now,
}).user;

describe("UserSpecifications.withId", () => {
  it("matches the user with the given id and no other", () => {
    deepStrictEqual(UserSpecifications.withId(aliceId)(alice), true);
    deepStrictEqual(UserSpecifications.withId(bobId)(alice), false);
  });

  it("carries an Eq criteria over the id column", () => {
    deepStrictEqual(UserSpecifications.withId(aliceId).criteria, {
      _tag: "Eq",
      field: "id",
      value: aliceId,
    });
  });
});

describe("UserSpecifications.withEmail", () => {
  it("matches the user with the given email and no other", () => {
    deepStrictEqual(UserSpecifications.withEmail("alice@example.com")(alice), true);
    deepStrictEqual(UserSpecifications.withEmail("nobody@example.com")(alice), false);
  });

  it("carries an Eq criteria over the email column", () => {
    deepStrictEqual(UserSpecifications.withEmail("alice@example.com").criteria, {
      _tag: "Eq",
      field: "email",
      value: "alice@example.com",
    });
  });
});
