import type * as DateTime from "effect/DateTime";
import * as Schema from "effect/Schema";
import { TodoId } from "./todo-id.js";

export class Todo extends Schema.Class<Todo>("Todo")({
  id: TodoId,
  title: Schema.String,
  completed: Schema.Boolean,
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
}) {}

export type CreateInput = {
  readonly id: TodoId;
  readonly title: string;
  readonly now: DateTime.Utc;
};

export const create = (input: CreateInput): Todo =>
  Todo.make({
    id: input.id,
    title: input.title,
    completed: false,
    createdAt: input.now,
    updatedAt: input.now,
  });

export type UpdateInput = {
  readonly title: string;
  readonly completed: boolean;
  readonly now: DateTime.Utc;
};

export const update = (todo: Todo, input: UpdateInput): Todo =>
  Todo.make({
    id: todo.id,
    title: input.title,
    completed: input.completed,
    createdAt: todo.createdAt,
    updatedAt: input.now,
  });
