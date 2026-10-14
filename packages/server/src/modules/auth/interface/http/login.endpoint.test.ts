import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";

import { loginEndpoint } from "./login.endpoint.js";
import {
  decodePkcePayload,
  encodePkcePayload,
  PKCE_COOKIE_MAX_AGE_MS,
  PKCE_COOKIE_NAME,
} from "./oidc-pkce-cookie.util.js";

// The login endpoint's overall flow — building the issuer's authorize URL,
// signing the cookie, stamping the 302 — is exercised end-to-end by
// Playwright (`packages/acceptance/setup/auth.setup.ts` and
// `packages/acceptance/specs/login.spec.ts`), which run against the real
// identity Worker and a real browser. What we lock down here are the
// deterministic substructures the endpoint composes: the PKCE cookie name,
// its short-lived TTL, and the encode/decode round-trip on the payload.
//
// These constants ship in HttpOnly response headers — silently dropping or
// renaming them would be a real, browser-visible regression. A small
// assertion is cheaper than discovering it from a failing Playwright run.

describe("loginEndpoint", () => {
  it("exports a callable endpoint factory", () => {
    expect(loginEndpoint).toBeInstanceOf(Function);
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
    assertSome(decodePkcePayload(encoded), original);
  });

  it("encodes to a URL-safe string (no '+', '/', or '=')", () => {
    const encoded = encodePkcePayload({
      state: "state with spaces & special / chars+",
      codeVerifier: "verifier?with=tricky&characters",
    });

    expect(encoded).not.toMatch(/[+/=]/);
  });

  it("rejects malformed base64url input", () => {
    assertNone(decodePkcePayload("!!!not-base64!!!"));
  });

  it("rejects valid base64url that doesn't decode to JSON", () => {
    const garbage = Buffer.from("not valid json at all").toString("base64url");
    assertNone(decodePkcePayload(garbage));
  });

  it("rejects JSON that is missing the state field", () => {
    const encoded = Buffer.from('{"codeVerifier":"v"}').toString("base64url");
    assertNone(decodePkcePayload(encoded));
  });

  it("rejects JSON that is missing the codeVerifier field", () => {
    const encoded = Buffer.from('{"state":"s"}').toString("base64url");
    assertNone(decodePkcePayload(encoded));
  });

  it("rejects JSON whose fields have the wrong types", () => {
    const encoded = Buffer.from('{"state":42,"codeVerifier":"v"}').toString("base64url");

    assertNone(decodePkcePayload(encoded));
  });

  it("rejects a JSON `null` payload (technically valid JSON)", () => {
    const encoded = Buffer.from("null").toString("base64url");
    assertNone(decodePkcePayload(encoded));
  });
});
