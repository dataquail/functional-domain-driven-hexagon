import { describe, expect, it } from "@effect/vitest";

import { idTokenEmailClaims } from "./id-token-claims.js";

const user = { email: "ada@example.com", emailVerified: true };

describe("idTokenEmailClaims", () => {
  it("puts the email and whether it is verified into the id_token when the email scope was granted", () => {
    expect(idTokenEmailClaims({ user, scopes: ["openid", "email"] })).toEqual({
      email: "ada@example.com",
      email_verified: true,
    });
  });

  it("reports an unverified address as unverified, so the server never links on it", () => {
    expect(
      idTokenEmailClaims({ user: { ...user, emailVerified: false }, scopes: ["email"] }),
    ).toEqual({ email: "ada@example.com", email_verified: false });
  });

  it("adds nothing when the client did not ask for the email scope", () => {
    expect(idTokenEmailClaims({ user, scopes: ["openid", "profile"] })).toEqual({});
  });
});
