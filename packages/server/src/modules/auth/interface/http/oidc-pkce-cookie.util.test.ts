import { describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";

import { decodePkcePayload, encodePkcePayload } from "./oidc-pkce-cookie.util";

// The PKCE cookie is the shared contract between the login endpoint (which
// packs {state, codeVerifier} and stamps it) and the callback endpoint (which
// unpacks it to complete the exchange). If encode/decode disagree, or decode
// trusts malformed input, the OIDC handshake silently breaks — so the codec is
// pinned here in isolation, without an OIDC client or HTTP runtime.

describe("oidc-pkce-cookie codec", () => {
  it("round-trips a payload", () => {
    const payload = { state: "st-123", codeVerifier: "cv-abc-XYZ_0" };
    assertSome(decodePkcePayload(encodePkcePayload(payload)), payload);
  });

  it("returns none for non-base64url / non-JSON input", () => {
    assertNone(decodePkcePayload("not valid base64url !!!"));
  });

  it("returns none when a required field is missing", () => {
    const encoded = Buffer.from('{"state":"only-state"}').toString("base64url");
    assertNone(decodePkcePayload(encoded));
  });

  it("returns none when a field is the wrong type", () => {
    const encoded = Buffer.from('{"state":"s","codeVerifier":42}').toString("base64url");

    assertNone(decodePkcePayload(encoded));
  });

  it("returns none for a JSON primitive rather than an object", () => {
    const encoded = Buffer.from('"just a string"').toString("base64url");
    assertNone(decodePkcePayload(encoded));
  });
});
