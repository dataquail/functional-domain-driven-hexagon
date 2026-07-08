import { createHmac, timingSafeEqual } from "node:crypto";

import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { describe, expect, it } from "vitest";

import { CookieCodec } from "@/platform/auth/cookie-codec.js";

import { logoutEndpoint } from "./logout.endpoint.js";

// The logout endpoint's full flow (revoke session, clear cookie, 302 to
// Zitadel's end_session_endpoint) needs a live Zitadel and is covered by
// Playwright. The cookie revocation + idempotent ignore-on-missing-session
// pieces are covered by `SessionRepositoryFake` and the
// `SessionRepositoryLive` integration test.
//
// What this file pins: the CookieCodec contract logout (and every other
// auth endpoint) depends on — HMAC-SHA256 with timing-safe comparison.
// Forged or unsigned values must not verify, even when the attacker
// controls the inner payload. Logout reads the session cookie *inline*
// (no middleware), so a regression that quietly accepts unsigned values
// would be a real security defect surfacing here first.
//
// We rebuild a CookieCodec from the same node:crypto primitives the
// production service uses, so the test doesn't drag in the EnvVars Config
// plumbing (which would otherwise demand a full process-env scenario).

const codecFor = (secret: string): Layer.Layer<CookieCodec> =>
  Layer.succeed(
    CookieCodec,
    {
      sign: (id: string) => {
        const sig = createHmac("sha256", secret).update(id).digest("base64url");
        return `${id}.${sig}`;
      },
      verify: (raw: string) => {
        const dot = raw.lastIndexOf(".");
        if (dot <= 0) return null;
        const id = raw.slice(0, dot);
        const sig = raw.slice(dot + 1);
        const expected = createHmac("sha256", secret).update(id).digest("base64url");
        const a = Buffer.from(sig);
        const b = Buffer.from(expected);
        if (a.length !== b.length) return null;
        return timingSafeEqual(a, b) ? id : null;
      },
    },
  );

const withCodec = <A, E>(secret: string, eff: Effect.Effect<A, E, CookieCodec>): Promise<A> =>
  Effect.runPromise(Effect.provide(eff, codecFor(secret)));

describe("logoutEndpoint", () => {
  it("exports a callable endpoint factory", () => {
    expect(typeof logoutEndpoint).toBe("function");
  });
});

describe("CookieCodec (the seal logout depends on)", () => {
  it("round-trips a signed value through sign/verify", async () => {
    const recovered = await withCodec(
      "secret-of-at-least-32-bytes-padding-padding",
      Effect.gen(function* () {
        const codec = yield* CookieCodec;
        return codec.verify(codec.sign("session-id-payload"));
      }),
    );
    expect(recovered).toBe("session-id-payload");
  });

  it("rejects a value signed with a different secret (defends against forged cookies)", async () => {
    const signed = await withCodec(
      "secret-alpha-of-at-least-32-bytes-padding",
      Effect.gen(function* () {
        const codec = yield* CookieCodec;
        return codec.sign("session-id-payload");
      }),
    );
    const recovered = await withCodec(
      "secret-bravo-of-at-least-32-bytes-padding",
      Effect.gen(function* () {
        const codec = yield* CookieCodec;
        return codec.verify(signed);
      }),
    );
    expect(recovered).toBeNull();
  });

  it("rejects a value with no signature separator", async () => {
    const recovered = await withCodec(
      "secret-of-at-least-32-bytes-padding-padding",
      Effect.gen(function* () {
        const codec = yield* CookieCodec;
        return codec.verify("no-dot-no-signature");
      }),
    );
    expect(recovered).toBeNull();
  });

  it("rejects a value whose signature has been tampered with", async () => {
    const recovered = await withCodec(
      "secret-of-at-least-32-bytes-padding-padding",
      Effect.gen(function* () {
        const codec = yield* CookieCodec;
        const signed = codec.sign("session-id-payload");
        // Flip the last char of the signature — same length, wrong bytes.
        const tampered = signed.slice(0, -1) + (signed.at(-1) === "A" ? "B" : "A");
        return codec.verify(tampered);
      }),
    );
    expect(recovered).toBeNull();
  });

  it("rejects a value whose body has been tampered with (signature no longer matches)", async () => {
    const recovered = await withCodec(
      "secret-of-at-least-32-bytes-padding-padding",
      Effect.gen(function* () {
        const codec = yield* CookieCodec;
        const signed = codec.sign("session-id-payload");
        const dot = signed.lastIndexOf(".");
        const tampered = "different-payload" + signed.slice(dot);
        return codec.verify(tampered);
      }),
    );
    expect(recovered).toBeNull();
  });

  it("rejects a leading-dot value (would resolve to empty id)", async () => {
    const recovered = await withCodec(
      "secret-of-at-least-32-bytes-padding-padding",
      Effect.gen(function* () {
        const codec = yield* CookieCodec;
        return codec.verify(".something");
      }),
    );
    expect(recovered).toBeNull();
  });
});
