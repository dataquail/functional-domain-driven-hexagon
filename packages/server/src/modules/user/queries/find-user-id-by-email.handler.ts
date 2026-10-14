import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { UserId } from "@/globals/application/ddd/ids/user-id.js";
import { translateDatabaseErrors } from "@/globals/infrastructure/database/translate-database-errors.js";
import { type FindUserIdByEmailPayload } from "@/modules/user/queries/find-user-id-by-email.query.js";

const UserIdRow = Schema.Struct({ id: Schema.String });

export const findUserIdByEmailHandler = Effect.fn("findUserIdByEmailHandler")(function* (
  query: FindUserIdByEmailPayload,
) {
  const sql = yield* Database.Database;

  const row = yield* sql`
    SELECT id FROM "user".users WHERE email = ${query.email}
  `.pipe(Database.maybeRow(UserIdRow), translateDatabaseErrors);

  return Option.getOrNull(Option.map(row, (found) => UserId.make(found.id)));
});
