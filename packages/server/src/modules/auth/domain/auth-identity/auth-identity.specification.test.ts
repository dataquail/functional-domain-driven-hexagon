import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";

import { UserId } from "@/globals/application/ddd/ids/user-id.js";

import { type AuthIdentity } from "./auth-identity.repository.js";
import { AuthIdentitySpecifications } from "./auth-identity.specification.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const identity: AuthIdentity = { subject: "identity-sub-1", userId, provider: "better-auth" };

describe("AuthIdentitySpecifications.bySubject", () => {
  it("matches the identity with the given subject and no other", () => {
    deepStrictEqual(AuthIdentitySpecifications.bySubject("identity-sub-1")(identity), true);
    deepStrictEqual(AuthIdentitySpecifications.bySubject("other-sub")(identity), false);
  });

  it("carries an Eq criteria over the subject column", () => {
    deepStrictEqual(AuthIdentitySpecifications.bySubject("identity-sub-1").criteria, {
      _tag: "Eq",
      field: "subject",
      value: "identity-sub-1",
    });
  });
});
