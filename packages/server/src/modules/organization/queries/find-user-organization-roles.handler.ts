import { Database, RowSchemas } from "@org/database/index";
import * as Effect from "effect/Effect";

import { translateDatabaseErrors } from "@/globals/infrastructure/database/translate-database-errors.js";
import { type FindUserOrganizationRolesPayload } from "@/modules/organization/queries/find-user-organization-roles.policy-query.js";

export const findUserOrganizationRolesHandler = Effect.fn("findUserOrganizationRolesHandler")(
  function* (query: FindUserOrganizationRolesPayload) {
    const sql = yield* Database.Database;
    const rows = yield* sql`
          SELECT organization_id, user_id, role, issued_by, created_at
          FROM "organization".organization_roles
          WHERE user_id = ${query.userId} AND organization_id = ${query.organizationId}
          ORDER BY created_at ASC
        `.pipe(Database.rows(RowSchemas.OrganizationRoleRow), translateDatabaseErrors);
    return {
      userId: query.userId,
      organizationId: query.organizationId,
      roles: rows.map((row) => row.role),
    };
  },
);
