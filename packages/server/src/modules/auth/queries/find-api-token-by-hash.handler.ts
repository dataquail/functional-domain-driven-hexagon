import { Database, RowSchemas } from "@org/database/index";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { UserId } from "@/globals/application/ddd/ids/user-id.js";
import { translateDatabaseErrors } from "@/globals/infrastructure/database/translate-database-errors.js";
import { ApiTokenId } from "@/modules/auth/domain/api-token/api-token.id.js";
import {
  ApiTokenExpired,
  ApiTokenNotFound,
  type ApiTokenPrincipalView,
  ApiTokenRevoked,
  type FindApiTokenByHashPayload,
} from "@/modules/auth/queries/find-api-token-by-hash.query.js";

// Looks up a token by hash and validates its lifecycle (revoked /
// expired). Used by the auth middleware via `QueryBus.execute(...)`; the
// bus-boundary span (ADR-0012) wraps this at dispatch time. An absent
// `expires_at` means non-expiring — such a token never lapses on time.
export const findApiTokenByHashHandler = Effect.fn("findApiTokenByHashHandler")(function* (
  query: FindApiTokenByHashPayload,
) {
  const sql = yield* Database.Database;

  const found = yield* sql`
    SELECT * FROM auth.api_tokens WHERE token_hash = ${query.tokenHash}
  `.pipe(Database.maybeRow(RowSchemas.ApiTokenRow), translateDatabaseErrors);

  if (Option.isNone(found)) {
    return yield* new ApiTokenNotFound();
  }

  const row = found.value;

  if (Option.isSome(Option.fromNullOr(row.revoked_at))) {
    return yield* new ApiTokenRevoked();
  }

  const now = yield* DateTime.now;

  const expired = Option.exists(Option.fromNullOr(row.expires_at), (expiresAt) =>
    DateTime.isLessThanOrEqualTo(expiresAt, now),
  );

  if (expired) {
    return yield* new ApiTokenExpired();
  }

  const view: ApiTokenPrincipalView = {
    id: ApiTokenId.make(row.id),
    userId: UserId.make(row.user_id),
  };

  return view;
});
