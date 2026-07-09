import * as DateTime from "effect/DateTime";
import * as Schema from "effect/Schema";

import { UserId } from "@/platform/ids/user-id.js";

import { ApiTokenId } from "./api-token.id.js";

// A long-lived bearer credential a user mints for the CLI / MCP / CI. Unlike
// `SessionRoot` (sliding TTL), an `ApiTokenRoot` has a FIXED expiry: it lapses
// at a wall-clock instant regardless of use. Only the sha256 hash of the
// secret is retained (`tokenHash`); the plaintext is shown once at mint time.
export class ApiTokenRoot extends Schema.Class<ApiTokenRoot>("ApiTokenRoot")({
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

const mint = (input: MintInput): ApiTokenRoot =>
  ApiTokenRoot.make({
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
  readonly token: ApiTokenRoot;
  readonly now: DateTime.Utc;
};

// Records usage only — stamps `lastUsedAt`. Deliberately does NOT advance
// `expiresAt`: API tokens are fixed-expiry, so usage never extends their
// lifetime (the contrast with `SessionRootOps.touch`, which slides the window).
const touch = (input: TouchInput): ApiTokenRoot =>
  ApiTokenRoot.make({
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
const isExpired = (token: ApiTokenRoot, now: DateTime.Utc): boolean =>
  token.expiresAt !== null && DateTime.isLessThanOrEqualTo(token.expiresAt, now);

// Wire format of the credential this aggregate protects: `pat_<publicId>_<secret>`.
//   - `publicId` is a short, NON-secret random id surfaced as the display
//     `prefix` so an owner can tell tokens apart in a listing.
//   - `secret` is high-entropy; only its hash (via `CredentialHash`) is ever
//     persisted. Entropy generation is impure and stays in the mint command;
//     these are the pure formatters the command composes.
export const API_TOKEN_PREFIX = "pat";

const assembleToken = (publicId: string, secret: string): string =>
  `${API_TOKEN_PREFIX}_${publicId}_${secret}`;

const displayPrefix = (publicId: string): string => `${API_TOKEN_PREFIX}_${publicId}`;

export const ApiTokenRootOps = { mint, touch, isExpired, assembleToken, displayPrefix } as const;
