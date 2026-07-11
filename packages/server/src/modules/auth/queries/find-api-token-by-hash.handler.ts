import { Database, RowSchemas, sql } from "@org/database/index";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { ApiTokenId } from "@/modules/auth/domain/api-token/api-token.id.js";
import {
  ApiTokenExpired,
  ApiTokenNotFound,
  type ApiTokenPrincipalView,
  ApiTokenRevoked,
  type FindApiTokenByHashQuery,
} from "@/modules/auth/queries/find-api-token-by-hash.query.js";
import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { UserId } from "@/platform/ids/user-id.js";

// Looks up a token by hash and validates its lifecycle (revoked /
// expired). Used by the auth middleware via `QueryBus.execute(...)`; the
// bus-boundary span (ADR-0012) wraps this at dispatch time. A null
// `expires_at` means non-expiring — such a token never lapses on time.
export const findApiTokenByHash = Effect.fn("findApiTokenByHash")(function* (
  query: FindApiTokenByHashQuery,
) {
  const db = yield* Database.Database;
  const row = yield* db
    .makeQuery((execute) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.ApiTokenRowStd)`
          SELECT * FROM auth.api_tokens WHERE token_hash = ${query.tokenHash}
        `),
      ),
    )()
    .pipe(
      Effect.catchTag("DatabaseError", Effect.die),
      Effect.catchTag("DatabaseUnavailable", (e) =>
        Effect.fail(new PersistenceUnavailable({ message: e.message })),
      ),
    );
  if (row === null) {
    return yield* new ApiTokenNotFound();
  }
  if (row.revoked_at !== null) {
    return yield* new ApiTokenRevoked();
  }
  const now = yield* DateTime.now;
  if (row.expires_at !== null && DateTime.isLessThanOrEqualTo(row.expires_at, now)) {
    return yield* new ApiTokenExpired();
  }
  const view: ApiTokenPrincipalView = {
    id: ApiTokenId.make(row.id),
    userId: UserId.make(row.user_id),
  };
  return view;
});
