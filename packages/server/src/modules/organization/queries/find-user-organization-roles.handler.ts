import { Database, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";

import { type FindUserOrganizationRolesQuery } from "@/modules/organization/queries/find-user-organization-roles.query.js";
import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";

export const findUserOrganizationRoles = Effect.fn("findUserOrganizationRoles")(function* (
  query: FindUserOrganizationRolesQuery,
) {
  const db = yield* Database.Database;
  const rows = yield* db
    .makeQuery((execute) =>
      execute((client) =>
        client.any(sql.type(RowSchemas.OrganizationRoleRowStd)`
          SELECT organization_id, user_id, role, issued_by, created_at
          FROM "organization".organization_roles
          WHERE user_id = ${query.userId} AND organization_id = ${query.organizationId}
          ORDER BY created_at ASC
        `),
      ),
    )()
    .pipe(
      Effect.catchTag("DatabaseError", Effect.die),
      Effect.catchTag("DatabaseUnavailable", (e) =>
        Effect.fail(new PersistenceUnavailable({ message: e.message })),
      ),
    );
  return {
    userId: query.userId,
    organizationId: query.organizationId,
    roles: rows.map((row) => row.role),
  };
});
