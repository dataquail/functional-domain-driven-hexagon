// Pure pack/unpack of the PKCE cookie payload — `{state, codeVerifier}` is
// serialized to a base64url-encoded JSON string before being signed by the
// CookieCodec and stamped into the browser. Lives next to the login/callback
// endpoints because both consume it, and isolating it lets the cookie shape
// (and its rejection behavior on malformed input) be unit-tested without an
// OIDC client or HTTP runtime.

export type PkcePayload = {
  readonly state: string;
  readonly codeVerifier: string;
};

export const PKCE_COOKIE_NAME = "oidc_pkce";

// 5 minutes — matches the OIDC PKCE handshake window. Cookie is short-lived
// because it carries the code_verifier; once the callback consumes it we
// clear it. If the user abandons mid-flow, expiry takes care of cleanup.
export const PKCE_COOKIE_MAX_AGE_MS = 300_000;

export const encodePkcePayload = (payload: PkcePayload): string =>
  Buffer.from(
    JSON.stringify({ state: payload.state, codeVerifier: payload.codeVerifier }),
  ).toString("base64url");

export const decodePkcePayload = (encoded: string): PkcePayload | null => {
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.state !== "string" || typeof obj.codeVerifier !== "string") return null;
    return { state: obj.state, codeVerifier: obj.codeVerifier };
  } catch {
    return null;
  }
};
