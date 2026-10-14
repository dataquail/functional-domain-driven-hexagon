import { describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";

import { ID_TOKEN_HINT_COOKIE_NAME, readIdTokenHint } from "./id-token-hint-cookie.util.js";

describe("readIdTokenHint", () => {
  it("returns the id_token the callback stored, so logout can end the issuer session silently", () => {
    assertSome(readIdTokenHint({ [ID_TOKEN_HINT_COOKIE_NAME]: "eyJ.id.token" }), "eyJ.id.token");
  });

  it("returns none when the cookie is absent or cleared, and logout asks the issuer to confirm", () => {
    assertNone(readIdTokenHint({}));
    assertNone(readIdTokenHint({ [ID_TOKEN_HINT_COOKIE_NAME]: "" }));
  });
});
