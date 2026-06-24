import * as DateTime from "effect/DateTime";
import * as Schema from "effect/Schema";

import { UserId } from "@/platform/ids/user-id.js";

import { ApiTokenId } from "./api-token-id.js";

// A long-lived bearer credential a user mints for the CLI / MCP / CI. Unlike
// `Session` (sliding TTL), an `ApiToken` has a FIXED expiry: it lapses at a
// wall-clock instant regardless of use. Only the sha256 hash of the secret
// is retained (`tokenHash`); the plaintext is shown once at mint time.
export class ApiToken extends Schema.Class<ApiToken>("ApiToken")({
  id: ApiTokenId,
  userId: UserId,
  tokenHash: Schema.String,
  // Non-secret display fragment (`pat_<publicId>`).
  prefix: Schema.String,
  label: Schema.String,
  // Nullable to leave room for non-expiring tokens later; `mint` always
  // sets it in v1.
  expiresAt: Schema.NullOr(Schema.DateTimeUtc),
  revokedAt: Schema.NullOr(Schema.DateTimeUtc),
  createdAt: Schema.DateTimeUtc,
  lastUsedAt: Schema.DateTimeUtc,
}) {}

export type MintInput = {
  readonly id: ApiTokenId;
  readonly userId: UserId;
  readonly tokenHash: string;
  readonly prefix: string;
  readonly label: string;
  readonly now: DateTime.Utc;
  readonly expiresAt: DateTime.Utc | null;
};

export const mint = (input: MintInput): ApiToken =>
  ApiToken.make({
    id: input.id,
    userId: input.userId,
    tokenHash: input.tokenHash,
    prefix: input.prefix,
    label: input.label,
    expiresAt: input.expiresAt,
    revokedAt: null,
    createdAt: input.now,
    lastUsedAt: input.now,
  });

export type TouchInput = {
  readonly token: ApiToken;
  readonly now: DateTime.Utc;
};

// Records usage only — stamps `lastUsedAt`. Deliberately does NOT advance
// `expiresAt`: API tokens are fixed-expiry, so usage never extends their
// lifetime (the contrast with `Session.touch`, which slides the window).
export const touch = (input: TouchInput): ApiToken =>
  ApiToken.make({
    id: input.token.id,
    userId: input.token.userId,
    tokenHash: input.token.tokenHash,
    prefix: input.token.prefix,
    label: input.token.label,
    expiresAt: input.token.expiresAt,
    revokedAt: input.token.revokedAt,
    createdAt: input.token.createdAt,
    lastUsedAt: input.now,
  });

// A null `expiresAt` means non-expiring (reserved for later); such a token
// never lapses on time alone.
export const isExpired = (token: ApiToken, now: DateTime.Utc): boolean =>
  token.expiresAt !== null && DateTime.lessThanOrEqualTo(token.expiresAt, now);
