import type * as DateTime from "effect/DateTime";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/platform/ids/organization-id.js";

import { TodoId } from "./todo-id.js";

export class Todo extends Schema.Class<Todo>("Todo")({
  id: TodoId,
  // Owning organization. Every todo is scoped to exactly one org
  // (Phase 5 multi-tenancy); the repository requires it on every
  // read/mutate so cross-tenant access can't leak.
  organizationId: OrganizationId,
  title: Schema.String,
  completed: Schema.Boolean,
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
}) {}

export type CreateInput = {
  readonly id: TodoId;
  readonly organizationId: OrganizationId;
  readonly title: string;
  readonly now: DateTime.Utc;
};

export const create = (input: CreateInput): Todo =>
  Todo.make({
    id: input.id,
    organizationId: input.organizationId,
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
    organizationId: todo.organizationId,
    title: input.title,
    completed: input.completed,
    createdAt: todo.createdAt,
    updatedAt: input.now,
  });
