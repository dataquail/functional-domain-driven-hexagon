import { type RowSchemas } from "@org/database/index";
import * as DateTime from "effect/DateTime";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.js";
import { type ColumnMap } from "@/globals/infrastructure/database/criteria-to-sql.js";
import { TodoId } from "@/modules/todos/domain/todo/todo.id.js";
import { TodoRoot } from "@/modules/todos/domain/todo/todo.root.js";

type Row = RowSchemas.TodoRow;

// Resolves the specification field names the live repository filters on to
// physical columns of todos.todos. Only filterable scalar fields need an
// entry; `satisfies` keeps the keys honest against the root.
export const columns = {
  id: "id",
  organizationId: "organization_id",
} as const satisfies Partial<Record<keyof TodoRoot, string>> & ColumnMap;

export const toDomain = (row: Row): TodoRoot =>
  new TodoRoot({
    id: TodoId.make(row.id),
    organizationId: OrganizationId.make(row.organization_id),
    title: row.title,
    completed: row.completed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

export type PersistenceRow = {
  readonly id: string;
  readonly organization_id: string;
  readonly title: string;
  readonly completed: boolean;
  readonly created_at: Date;
  readonly updated_at: Date;
};

export const toPersistence = (todo: TodoRoot): PersistenceRow => ({
  id: todo.id,
  organization_id: todo.organizationId,
  title: todo.title,
  completed: todo.completed,
  created_at: DateTime.toDate(todo.createdAt),
  updated_at: DateTime.toDate(todo.updatedAt),
});
