import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";

import { UserId } from "@/platform/ids/user-id.js";

import { type AuthIdentity } from "./auth-identity.repository.js";
import { AuthIdentitySpecifications } from "./auth-identity.specification.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const identity: AuthIdentity = { subject: "zitadel-sub-1", userId, provider: "zitadel" };

describe("AuthIdentitySpecifications.bySubject", () => {
  it("matches the identity with the given subject and no other", () => {
    deepStrictEqual(AuthIdentitySpecifications.bySubject("zitadel-sub-1")(identity), true);
    deepStrictEqual(AuthIdentitySpecifications.bySubject("other-sub")(identity), false);
  });

  it("carries an Eq criteria over the subject column", () => {
    deepStrictEqual(AuthIdentitySpecifications.bySubject("zitadel-sub-1").criteria, {
      _tag: "Eq",
      field: "subject",
      value: "zitadel-sub-1",
    });
  });
});
