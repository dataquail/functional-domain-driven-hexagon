// Todo fixtures for the integration tier. Each factory returns a
// contract-shape object with sensible defaults so tests can override
// only the fields they care about. The drift gate is the sibling test:
// each fixture's default output must decode through the contract's
// response schema.

import * as TodosContract from "@org/contracts/api/TodosContract";
import { OrganizationId, TodoId } from "@org/contracts/EntityIds";

const DEFAULT_TODO_ID = TodoId.make("33333333-3333-3333-3333-333333333333");

/** The org every todos test is scoped to, unless it says otherwise. */
export const TEST_ORG_ID = OrganizationId.make("44444444-4444-4444-4444-444444444444");

/** A valid `TodosContract.Todo` with overridable fields. */
export const makeTodo = (overrides: Partial<TodosContract.Todo> = {}): TodosContract.Todo =>
  new TodosContract.Todo({
    id: DEFAULT_TODO_ID,
    title: "Buy milk",
    completed: false,
    ...overrides,
  });

/** A valid `CreateTodoPayload` — the shape the add-todo form submits. */
export const makeCreateTodoPayload = (
  overrides: Partial<TodosContract.CreateTodoPayload> = {},
): TodosContract.CreateTodoPayload =>
  new TodosContract.CreateTodoPayload({
    title: "Walk the dog",
    ...overrides,
  });
