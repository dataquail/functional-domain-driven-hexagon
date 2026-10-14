import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";

import { CookieCodec } from "@/globals/infrastructure/auth/cookie-codec.ts";

import { logoutEndpoint } from "./logout.endpoint.ts";

// The logout endpoint's full flow (revoke session, clear cookies, 302 to the
// identity Worker's end-session endpoint) needs a live issuer and is covered by
// the acceptance login spec. The id_token hint it forwards is pinned by
// `id-token-hint-cookie.util.test.ts`; the cookie revocation + idempotent
// ignore-on-missing-session pieces by `SessionRepositoryFake` and the
// `SessionRepositoryLive` integration test.
//
// What this file pins: the CookieCodec contract logout (and every other
// auth endpoint) depends on — HMAC-SHA256 with timing-safe comparison.
// Forged or unsigned values must not verify, even when the attacker
// controls the inner payload. Logout reads the session cookie *inline*
// (no middleware), so a regression that quietly accepts unsigned values
// would be a real security defect surfacing here first.

const SECRET = "secret-of-at-least-32-bytes-padding-padding";

const signWith = (secret: string, value: string) =>
  Effect.map(Effect.service(CookieCodec), (codec) => codec.sign(value)).pipe(
    Effect.provide(CookieCodec.layerForSecret(secret)),
  );

const verifyWith = (secret: string, raw: string) =>
  Effect.map(Effect.service(CookieCodec), (codec) => codec.verify(raw)).pipe(
    Effect.provide(CookieCodec.layerForSecret(secret)),
  );

const flipLastChar = (value: string): string => {
  if (value.endsWith("A")) return `${value.slice(0, -1)}B`;

  return `${value.slice(0, -1)}A`;
};

describe("logoutEndpoint", () => {
  it("exports a callable endpoint factory", () => {
    expect(logoutEndpoint).toBeInstanceOf(Function);
  });
});

describe("CookieCodec (the seal logout depends on)", () => {
  it.effect("round-trips a signed value through sign/verify", () =>
    Effect.gen(function* () {
      const signed = yield* signWith(SECRET, "session-id-payload");
      assertSome(yield* verifyWith(SECRET, signed), "session-id-payload");
    }),
  );

  it.effect("rejects a value signed with a different secret (defends against forged cookies)", () =>
    Effect.gen(function* () {
      const signed = yield* signWith(
        "secret-alpha-of-at-least-32-bytes-padding",
        "session-id-payload",
      );

      assertNone(yield* verifyWith("secret-bravo-of-at-least-32-bytes-padding", signed));
    }),
  );

  it.effect("rejects a value with no signature separator", () =>
    Effect.gen(function* () {
      assertNone(yield* verifyWith(SECRET, "no-dot-no-signature"));
    }),
  );

  it.effect("rejects a value whose signature has been tampered with", () =>
    Effect.gen(function* () {
      const signed = yield* signWith(SECRET, "session-id-payload");
      // Flip the last char of the signature — same length, wrong bytes.
      assertNone(yield* verifyWith(SECRET, flipLastChar(signed)));
    }),
  );

  it.effect("rejects a value whose body has been tampered with (signature no longer matches)", () =>
    Effect.gen(function* () {
      const signed = yield* signWith(SECRET, "session-id-payload");
      const tampered = "different-payload" + signed.slice(signed.lastIndexOf("."));
      assertNone(yield* verifyWith(SECRET, tampered));
    }),
  );

  it.effect("rejects a leading-dot value (would resolve to empty id)", () =>
    Effect.gen(function* () {
      assertNone(yield* verifyWith(SECRET, ".something"));
    }),
  );
});
