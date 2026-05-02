import { EnvVars } from "@/common/env-vars.js";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import { createHmac, timingSafeEqual } from "node:crypto";

// Signs a session id with HMAC-SHA256 and packs as `<id>.<signature>`.
// JS-readable callers cannot mint or alter the value without knowing the
// secret. This is application-level sealing on top of the HttpOnly+Secure
// cookie attributes, not a substitute for them.
export class CookieCodec extends Effect.Service<CookieCodec>()("CookieCodec", {
  accessors: true,
  effect: Effect.gen(function* () {
    const env = yield* EnvVars;
    const secret = Redacted.value(env.SESSION_COOKIE_SECRET);

    const sign = (id: string): string => {
      const sig = createHmac("sha256", secret).update(id).digest("base64url");
      return `${id}.${sig}`;
    };

    const verify = (raw: string): string | null => {
      const dot = raw.lastIndexOf(".");
      if (dot <= 0) return null;
      const id = raw.slice(0, dot);
      const sig = raw.slice(dot + 1);
      const expected = createHmac("sha256", secret).update(id).digest("base64url");
      const a = Buffer.from(sig);
      const b = Buffer.from(expected);
      if (a.length !== b.length) return null;
      return timingSafeEqual(a, b) ? id : null;
    };

    return { sign, verify } as const;
  }),
  dependencies: [EnvVars.Default],
}) {}
