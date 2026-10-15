import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id";
import { translateDatabaseErrors } from "@/globals/infrastructure/database/translate-database-errors";
import {
  type FindTodoOrganizationPayload,
  type TodoOrganizationView,
} from "@/modules/todos/queries/find-todo-organization.query";

const OrgIdRow = Schema.Struct({ organization_id: Schema.String });

export const findTodoOrganizationHandler = Effect.fn("findTodoOrganizationHandler")(function* (
  query: FindTodoOrganizationPayload,
) {
  const sql = yield* Database.Database;

  const row = yield* sql`
    SELECT organization_id FROM todos.todos
    WHERE id = ${query.todoId} AND organization_id = ${query.organizationId}
  `.pipe(Database.maybeRow(OrgIdRow), translateDatabaseErrors);

  return Option.map(
    row,
    (found): TodoOrganizationView => ({
      organizationId: OrganizationId.make(found.organization_id),
    }),
  );
});
