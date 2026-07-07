import { describe, expect, it } from "vitest";

import { decodePkcePayload, encodePkcePayload } from "./oidc-pkce-cookie.util.js";

// The PKCE cookie is the shared contract between the login endpoint (which
// packs {state, codeVerifier} and stamps it) and the callback endpoint (which
// unpacks it to complete the exchange). If encode/decode disagree, or decode
// trusts malformed input, the OIDC handshake silently breaks — so the codec is
// pinned here in isolation, without an OIDC client or HTTP runtime.

describe("oidc-pkce-cookie codec", () => {
  it("round-trips a payload", () => {
    const payload = { state: "st-123", codeVerifier: "cv-abc-XYZ_0" };
    const decoded = decodePkcePayload(encodePkcePayload(payload));
    expect(decoded).toEqual(payload);
  });

  it("returns null for non-base64url / non-JSON input", () => {
    expect(decodePkcePayload("not valid base64url !!!")).toBeNull();
  });

  it("returns null when a required field is missing", () => {
    const encoded = Buffer.from(JSON.stringify({ state: "only-state" })).toString("base64url");
    expect(decodePkcePayload(encoded)).toBeNull();
  });

  it("returns null when a field is the wrong type", () => {
    const encoded = Buffer.from(JSON.stringify({ state: "s", codeVerifier: 42 })).toString(
      "base64url",
    );
    expect(decodePkcePayload(encoded)).toBeNull();
  });

  it("returns null for a JSON primitive rather than an object", () => {
    const encoded = Buffer.from(JSON.stringify("just a string")).toString("base64url");
    expect(decodePkcePayload(encoded)).toBeNull();
  });
});
