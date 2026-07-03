import { describe, expect, it } from "vitest";

import { loginEndpoint } from "./login.endpoint.js";
import {
  decodePkcePayload,
  encodePkcePayload,
  PKCE_COOKIE_MAX_AGE_MS,
  PKCE_COOKIE_NAME,
} from "./oidc-pkce-cookie.util.js";

// The login endpoint's overall flow — building the Zitadel authorize URL,
// signing the cookie, stamping the 302 — is exercised end-to-end by
// Playwright (`packages/acceptance/setup/auth.setup.ts` and
// `packages/acceptance/specs/login.spec.ts`), which run against a real
// Zitadel instance and a real browser. What we lock down here are the
// deterministic substructures the endpoint composes: the PKCE cookie name,
// its short-lived TTL, and the encode/decode round-trip on the payload.
//
// These constants ship in HttpOnly response headers — silently dropping or
// renaming them would be a real, browser-visible regression. A small
// assertion is cheaper than discovering it from a failing Playwright run.

describe("loginEndpoint", () => {
  it("exports a callable endpoint factory", () => {
    expect(typeof loginEndpoint).toBe("function");
  });
});

describe("PKCE cookie constants", () => {
  it("uses the literal cookie name browsers and the callback rely on", () => {
    // If this changes, the callback endpoint stops finding the cookie and
    // every login fails. Pin the literal so a rename triggers this test.
    expect(PKCE_COOKIE_NAME).toBe("oidc_pkce");
  });

  it("uses a 5-minute TTL (long enough for the OIDC handshake, short enough on abandon)", () => {
    expect(PKCE_COOKIE_MAX_AGE_MS).toBe(300_000);
  });
});

describe("encodePkcePayload / decodePkcePayload", () => {
  it("round-trips state and codeVerifier through base64url JSON", () => {
    const original = {
      state: "abc123-state-token",
      codeVerifier: "verifier-string-of-length-43+characters-required",
    };
    const encoded = encodePkcePayload(original);
    const decoded = decodePkcePayload(encoded);
    expect(decoded).toEqual(original);
  });

  it("encodes to a URL-safe string (no '+', '/', or '=')", () => {
    const encoded = encodePkcePayload({
      state: "state with spaces & special / chars+",
      codeVerifier: "verifier?with=tricky&characters",
    });
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it("rejects malformed base64url input", () => {
    expect(decodePkcePayload("!!!not-base64!!!")).toBeNull();
  });

  it("rejects valid base64url that doesn't decode to JSON", () => {
    const garbage = Buffer.from("not valid json at all").toString("base64url");
    expect(decodePkcePayload(garbage)).toBeNull();
  });

  it("rejects JSON that is missing the state field", () => {
    const encoded = Buffer.from(JSON.stringify({ codeVerifier: "v" })).toString("base64url");
    expect(decodePkcePayload(encoded)).toBeNull();
  });

  it("rejects JSON that is missing the codeVerifier field", () => {
    const encoded = Buffer.from(JSON.stringify({ state: "s" })).toString("base64url");
    expect(decodePkcePayload(encoded)).toBeNull();
  });

  it("rejects JSON whose fields have the wrong types", () => {
    const encoded = Buffer.from(JSON.stringify({ state: 42, codeVerifier: "v" })).toString(
      "base64url",
    );
    expect(decodePkcePayload(encoded)).toBeNull();
  });

  it("rejects a null payload (JSON `null` is technically valid JSON)", () => {
    const encoded = Buffer.from("null").toString("base64url");
    expect(decodePkcePayload(encoded)).toBeNull();
  });
});
