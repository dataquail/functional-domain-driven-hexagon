import { createHmac, timingSafeEqual } from "node:crypto";

import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";

import { EnvVars } from "@/globals/infrastructure/config/env-vars.js";

const codecForSecret = (secret: string) => {
  const sign = (id: string): string => {
    const sig = createHmac("sha256", secret).update(id).digest("base64url");

    return `${id}.${sig}`;
  };

  const signatureMatches = (id: string, signature: string): boolean => {
    const actual = Buffer.from(signature);
    const expected = Buffer.from(sign(id).slice(id.length + 1));

    return actual.length === expected.length && timingSafeEqual(actual, expected);
  };

  const verify = (raw: string): Option.Option<string> => {
    const dot = raw.lastIndexOf(".");

    if (dot <= 0) return Option.none();

    const id = raw.slice(0, dot);

    return Option.liftPredicate(id, (candidate) => signatureMatches(candidate, raw.slice(dot + 1)));
  };

  return { sign, verify } as const;
};

const make = Effect.map(EnvVars, (env) =>
  codecForSecret(Redacted.value(env.SESSION_COOKIE_SECRET)),
);

// Signs a session id with HMAC-SHA256 and packs as `<id>.<signature>`.
// JS-readable callers cannot mint or alter the value without knowing the
// secret. This is application-level sealing on top of the HttpOnly+Secure
// cookie attributes, not a substitute for them.
export class CookieCodec extends Context.Service<CookieCodec, Effect.Success<typeof make>>()(
  "CookieCodec",
) {
  public static readonly layer = Layer.effect(CookieCodec, make).pipe(Layer.provide(EnvVars.layer));

  public static readonly layerForSecret = (secret: string): Layer.Layer<CookieCodec> =>
    Layer.succeed(CookieCodec, CookieCodec.of(codecForSecret(secret)));
}
