import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";

import { UserId } from "@/globals/application/ddd/ids/user-id.js";
import { Criteria } from "@/globals/application/ddd/specification.js";

import { UserRootOps } from "./user.root-ops.js";
import { UserSpecifications } from "./user.specification.js";

const aliceId = UserId.make("11111111-1111-1111-1111-111111111111");
const bobId = UserId.make("22222222-2222-2222-2222-222222222222");
const now = DateTime.makeUnsafe("2025-01-01T00:00:00Z");

const alice = UserRootOps.create({
  id: aliceId,
  email: "alice@example.com",
  address: Option.none(),
  now,
}).user;

describe("UserSpecifications.withId", () => {
  it("matches the user with the given id and no other", () => {
    deepStrictEqual(UserSpecifications.withId(aliceId)(alice), true);
    deepStrictEqual(UserSpecifications.withId(bobId)(alice), false);
  });

  it("carries an Eq criteria over the id column", () => {
    deepStrictEqual(
      UserSpecifications.withId(aliceId).criteria,
      Criteria.Eq({ field: "id", value: aliceId }),
    );
  });
});

describe("UserSpecifications.withEmail", () => {
  it("matches the user with the given email and no other", () => {
    deepStrictEqual(UserSpecifications.withEmail("alice@example.com")(alice), true);
    deepStrictEqual(UserSpecifications.withEmail("nobody@example.com")(alice), false);
  });

  it("carries an Eq criteria over the email column", () => {
    deepStrictEqual(
      UserSpecifications.withEmail("alice@example.com").criteria,
      Criteria.Eq({ field: "email", value: "alice@example.com" }),
    );
  });
});
