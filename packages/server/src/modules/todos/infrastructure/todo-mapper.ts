import { type RowSchemas } from "@org/database/index";
import * as DateTime from "effect/DateTime";

import { OrganizationId } from "@/platform/ids/organization-id.js";

import { Todo } from "../domain/todo.js";
import { TodoId } from "../domain/todo-id.js";

type Row = RowSchemas.TodoRow;

export const toDomain = (row: Row): Todo =>
  new Todo({
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

export const toPersistence = (todo: Todo): PersistenceRow => ({
  id: todo.id,
  organization_id: todo.organizationId,
  title: todo.title,
  completed: todo.completed,
  created_at: DateTime.toDate(todo.createdAt),
  updated_at: DateTime.toDate(todo.updatedAt),
});
