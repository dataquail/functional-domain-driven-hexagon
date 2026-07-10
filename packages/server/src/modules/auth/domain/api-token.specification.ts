import * as DateTime from "effect/DateTime";

import { type ApiTokenRoot } from "./api-token.root.js";

// A null `expiresAt` means non-expiring (reserved for later); such a token
// never lapses on time alone.
const isExpired = (token: ApiTokenRoot, now: DateTime.Utc): boolean =>
  token.expiresAt !== null && DateTime.isLessThanOrEqualTo(token.expiresAt, now);

export const ApiTokenSpecifications = { isExpired } as const;
