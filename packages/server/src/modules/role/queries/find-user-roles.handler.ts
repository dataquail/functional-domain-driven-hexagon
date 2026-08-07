import { Database, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";

import { type FindUserRolesPayload } from "@/modules/role/queries/find-user-roles.policy-query.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

// `makeQuery` (not bare `execute`) so the read joins the ambient
// transaction when one exists — this query is dispatched by consumers' ACL adapters
// during a command's authorization, inside its unit of work.
export const findUserRolesHandler = Effect.fn("findUserRolesHandler")(function* (
  query: FindUserRolesPayload,
) {
  const db = yield* Database.Database;
  const readRoles = db.makeQuery((execute) =>
    execute((client) =>
      client.any(sql.type(RowSchemas.PlatformRoleRowStd)`
          SELECT user_id, role, granted_at FROM platform.roles
          WHERE user_id = ${query.userId}
          ORDER BY granted_at ASC
        `),
    ),
  );
  const rows = yield* readRoles().pipe(translateDatabaseErrors);
  return { userId: query.userId, roles: rows.map((row) => row.role) };
});
