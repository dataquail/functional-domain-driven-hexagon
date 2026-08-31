import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import {
  type FindTodoOrganizationPayload,
  type TodoOrganizationView,
} from "@/modules/todos/queries/find-todo-organization.query.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

const OrgIdRow = Schema.Struct({ organization_id: Schema.String });

export const findTodoOrganizationHandler = Effect.fn("findTodoOrganizationHandler")(function* (
  query: FindTodoOrganizationPayload,
) {
  const sql = yield* Database.Database;
  const row = yield* sql`
    SELECT organization_id FROM todos.todos
    WHERE id = ${query.todoId} AND organization_id = ${query.organizationId}
  `.pipe(Database.maybeRow(OrgIdRow), translateDatabaseErrors);
  return row === null
    ? null
    : ({
        organizationId: OrganizationId.make(row.organization_id),
      } satisfies TodoOrganizationView);
});
