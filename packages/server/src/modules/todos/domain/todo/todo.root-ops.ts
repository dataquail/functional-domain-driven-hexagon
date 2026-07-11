import type * as DateTime from "effect/DateTime";

import { type OrganizationId } from "@/platform/ids/organization-id.js";

import { type TodoId } from "./todo.id.js";
import { TodoRoot } from "./todo.root.js";

export type CreateInput = {
  readonly id: TodoId;
  readonly organizationId: OrganizationId;
  readonly title: string;
  readonly now: DateTime.Utc;
};

const create = (input: CreateInput): TodoRoot =>
  TodoRoot.make({
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

const update = (todo: TodoRoot, input: UpdateInput): TodoRoot =>
  TodoRoot.make({
    id: todo.id,
    organizationId: todo.organizationId,
    title: input.title,
    completed: input.completed,
    createdAt: todo.createdAt,
    updatedAt: input.now,
  });

// Marks the todo done. A first-class verb (not a generic `update`) because
// the CLI exposes "complete" as its own command and there's no reason to
// require the title to flip the flag. Idempotent: completing a done todo
// just re-stamps `updatedAt`.
const complete = (todo: TodoRoot, now: DateTime.Utc): TodoRoot =>
  TodoRoot.make({
    id: todo.id,
    organizationId: todo.organizationId,
    title: todo.title,
    completed: true,
    createdAt: todo.createdAt,
    updatedAt: now,
  });

export const TodoRootOps = { create, update, complete } as const;
