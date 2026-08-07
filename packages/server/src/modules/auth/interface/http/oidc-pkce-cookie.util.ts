import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

// Pure pack/unpack of the PKCE cookie payload — `{state, codeVerifier}` is
// serialized to a base64url-encoded JSON string before being signed by the
// CookieCodec and stamped into the browser. Lives next to the login/callback
// endpoints because both consume it, and isolating it lets the cookie shape
// (and its rejection behavior on malformed input) be unit-tested without an
// OIDC client or HTTP runtime.

const PkcePayloadSchema = Schema.Struct({
  state: Schema.String,
  codeVerifier: Schema.String,
});

export type PkcePayload = Schema.Schema.Type<typeof PkcePayloadSchema>;

// The cookie carries browser-supplied input, so the JSON structure is decoded
// by the schema rather than by hand. Base64url stays with `Buffer` — that half
// is a transport encoding, not a shape to validate.
const PkcePayloadAsJson = Schema.fromJsonString(PkcePayloadSchema);
const encodeAsJson = Schema.encodeSync(PkcePayloadAsJson);
const decodeFromJson = Schema.decodeUnknownOption(PkcePayloadAsJson);

export const PKCE_COOKIE_NAME = "oidc_pkce";

// 5 minutes — matches the OIDC PKCE handshake window. Cookie is short-lived
// because it carries the code_verifier; once the callback consumes it we
// clear it. If the user abandons mid-flow, expiry takes care of cleanup.
export const PKCE_COOKIE_MAX_AGE_MS = 300_000;

export const encodePkcePayload = (payload: PkcePayload): string =>
  Buffer.from(encodeAsJson(payload)).toString("base64url");

export const decodePkcePayload = (encoded: string): PkcePayload | null =>
  Option.getOrNull(decodeFromJson(Buffer.from(encoded, "base64url").toString("utf8")));
