import { Database, RowSchemas } from "@org/database/index";
import * as Effect from "effect/Effect";

import { type FindUserRolesPayload } from "@/modules/role/queries/find-user-roles.policy-query.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

// `makeQuery` (not bare `execute`) so the read joins the ambient
// transaction when one exists — this query is dispatched by consumers' ACL adapters
// during a command's authorization, inside its unit of work.
export const findUserRolesHandler = Effect.fn("findUserRolesHandler")(function* (
  query: FindUserRolesPayload,
) {
  const sql = yield* Database.Database;
  const statement = sql`
          SELECT user_id, role, granted_at FROM platform.roles
          WHERE user_id = ${query.userId}
          ORDER BY granted_at ASC
        `.pipe(Database.rows(RowSchemas.PlatformRoleRow));
  const rows = yield* statement.pipe(translateDatabaseErrors);
  return { userId: query.userId, roles: rows.map((row) => row.role) };
});
