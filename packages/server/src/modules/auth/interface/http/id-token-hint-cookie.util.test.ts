import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";

import { ID_TOKEN_HINT_COOKIE_NAME, readIdTokenHint } from "./id-token-hint-cookie.util.js";

describe("readIdTokenHint", () => {
  it("returns the id_token the callback stored, so logout can end the issuer session silently", () => {
    deepStrictEqual(
      readIdTokenHint({ [ID_TOKEN_HINT_COOKIE_NAME]: "eyJ.id.token" }),
      "eyJ.id.token",
    );
  });

  it("returns null when the cookie is absent or cleared, and logout asks the issuer to confirm", () => {
    deepStrictEqual(readIdTokenHint({}), null);
    deepStrictEqual(readIdTokenHint({ [ID_TOKEN_HINT_COOKIE_NAME]: "" }), null);
  });
});
