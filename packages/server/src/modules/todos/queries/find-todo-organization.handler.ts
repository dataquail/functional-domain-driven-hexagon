import { PersistenceUnavailable } from "@org/cqrs";
import { Database, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import {
  type FindTodoOrganizationPayload,
  type TodoOrganizationView,
} from "@/modules/todos/queries/find-todo-organization.query.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

const OrgIdRowStd = Schema.toStandardSchemaV1(Schema.Struct({ organization_id: Schema.String }));

// `makeQuery` (not bare `execute`) so the read joins the ambient transaction when
// one exists — the authz resolver runs this during a command's authorization,
// inside that command's unit of work.
export const findTodoOrganizationHandler = Effect.fn("findTodoOrganizationHandler")(function* (
  query: FindTodoOrganizationPayload,
) {
  const db = yield* Database.Database;
  const readTodo = db.makeQuery((execute) =>
    execute((client) =>
      client.maybeOne(sql.type(OrgIdRowStd)`
        SELECT organization_id FROM todos.todos
        WHERE id = ${query.todoId} AND organization_id = ${query.organizationId}
      `),
    ),
  );
  const row = yield* readTodo().pipe(
    Effect.catchTag("DatabaseError", Effect.die),
    Effect.catchTag("DatabaseUnavailable", (e) =>
      Effect.fail(new PersistenceUnavailable({ message: e.message })),
    ),
  );
  return row === null
    ? null
    : ({
        organizationId: OrganizationId.make(row.organization_id),
      } satisfies TodoOrganizationView);
});
