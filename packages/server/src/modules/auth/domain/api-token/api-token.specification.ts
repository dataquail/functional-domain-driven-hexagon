import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";

import { type UserId } from "@/globals/application/ddd/ids/user-id.ts";
import { Spec, type Specification } from "@/globals/application/ddd/specification.ts";

import { type ApiTokenId } from "./api-token.id.ts";
import { type ApiTokenRoot } from "./api-token.root.ts";

// Translatable specs (carry a Criteria → usable as repository filters and as
// in-memory guards). The field-name strings live here and in the mapper's
// column map; `Spec.eq`/`isNull` type them against ApiTokenRoot so a typo is a
// compile error.
const withId = (id: ApiTokenId): Specification<ApiTokenRoot> =>
  Spec.eq<ApiTokenRoot, "id">("id", id);

const withHash = (tokenHash: string): Specification<ApiTokenRoot> =>
  Spec.eq<ApiTokenRoot, "tokenHash">("tokenHash", tokenHash);

// Active = not revoked. Composed into `forUser` so the owner's listing hides
// revoked tokens, matching the live `WHERE ... AND revoked_at IS NULL`.
const isActive = Spec.isNull<ApiTokenRoot>("revokedAt");

const forUser = (userId: UserId): Specification<ApiTokenRoot> =>
  Spec.and(Spec.eq<ApiTokenRoot, "userId">("userId", userId), isActive);

// An absent `expiresAt` means non-expiring (reserved for later); such a token
// never lapses on time alone. Eval-only (a plain predicate, not a
// Specification): DateTime comparison has no Criteria node, so it never needs
// SQL translation.
const isExpired = (token: ApiTokenRoot, now: DateTime.Utc): boolean =>
  Option.exists(token.expiresAt, (expiresAt) => DateTime.isLessThanOrEqualTo(expiresAt, now));

export const ApiTokenSpecifications = { withId, withHash, forUser, isExpired } as const;
