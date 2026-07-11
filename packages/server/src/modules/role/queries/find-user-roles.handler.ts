import { Database, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";

import { type FindUserRolesQuery } from "@/modules/role/queries/find-user-roles.query.js";
import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";

// `makeQuery` (not bare `execute`) so the read joins the ambient
// transaction when one exists — this query is dispatched by `RoleService`
// during a command's authorization, inside its unit of work.
export const findUserRoles = Effect.fn("findUserRoles")(function* (query: FindUserRolesQuery) {
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
  const rows = yield* readRoles().pipe(
    Effect.catchTag("DatabaseError", Effect.die),
    Effect.catchTag("DatabaseUnavailable", (e) =>
      Effect.fail(new PersistenceUnavailable({ message: e.message })),
    ),
  );
  return { userId: query.userId, roles: rows.map((row) => row.role) };
});
