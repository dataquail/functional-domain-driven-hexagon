import { createHash } from "node:crypto";

// Pure token-format helpers for the `ApiToken` credential. Random secret
// generation (the only impure step) lives in the mint command via
// `Effect.sync`; everything here is deterministic so it stays in the
// domain. `hashToken` is shared with the auth middleware (via the module
// barrel) so the mint-time hash and the per-request lookup hash agree.
//
// Wire format: `pat_<publicId>_<secret>`.
//   - `publicId` is a short, NON-secret random id surfaced as the display
//     `prefix` so an owner can tell tokens apart in a listing.
//   - `secret` is high-entropy (32 random bytes); only its sha256 hash is
//     ever persisted.

export const API_TOKEN_PREFIX = "pat";

export const assembleToken = (publicId: string, secret: string): string =>
  `${API_TOKEN_PREFIX}_${publicId}_${secret}`;

export const displayPrefix = (publicId: string): string => `${API_TOKEN_PREFIX}_${publicId}`;

// sha256 hex. The tokens are high-entropy random values, so an unsalted
// digest is sufficient — there is no low-entropy space to brute-force if
// the column ever leaks.
export const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");
