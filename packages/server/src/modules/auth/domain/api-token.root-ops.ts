import type * as DateTime from "effect/DateTime";

import { type UserId } from "@/platform/ids/user-id.js";

import { type ApiTokenId } from "./api-token.id.js";
import { ApiTokenRoot } from "./api-token.root.js";

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

export const ApiTokenRootOps = { mint, touch, assembleToken, displayPrefix } as const;
