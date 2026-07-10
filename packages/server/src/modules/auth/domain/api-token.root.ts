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
