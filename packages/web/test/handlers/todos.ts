// Per-feature MSW handler builders for the Todos contract. Tests
// compose these per-scenario via `server.use(...)`. No shared state;
// each handler returns exactly what the test asks for.

import * as TodosContract from "@org/contracts/api/TodosContract";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import * as Effect from "effect/Effect";

import { makeTodo } from "../fixtures/todo";
import { getEndpoint, typedHandler } from "../typed-handler";

const listEndpoint = getEndpoint(TodosContract.Group, "get");
const createEndpoint = getEndpoint(TodosContract.Group, "create");
const updateEndpoint = getEndpoint(TodosContract.Group, "update");
const deleteEndpoint = getEndpoint(TodosContract.Group, "delete");

export const todosHandlers = {
  /** GET /orgs/:orgId/todos — returns whatever the test passed. */
  list: (todos: ReadonlyArray<TodosContract.Todo> = []) =>
    typedHandler(listEndpoint, () => Effect.succeed(todos)),

  /** POST /orgs/:orgId/todos — echoes the submitted title back as a new todo. */
  create: (outcome: { readonly result: "success" | "Forbidden" } = { result: "success" }) =>
    typedHandler(createEndpoint, ({ payload }) => {
      if (outcome.result === "Forbidden") {
        return Effect.fail(new CustomHttpApiError.Forbidden({ message: "Not a member." }));
      }
      return Effect.succeed(makeTodo({ title: payload.title }));
    }),

  /** PUT /orgs/:orgId/todos/:id — echoes the submitted state back. */
  update: (outcome: { readonly result: "success" | "TodoNotFoundError" } = { result: "success" }) =>
    typedHandler(updateEndpoint, ({ path, payload }) => {
      if (outcome.result === "TodoNotFoundError") {
        return Effect.fail(new TodosContract.TodoNotFoundError({ message: "Todo not found." }));
      }
      return Effect.succeed(
        makeTodo({ id: path.id, title: payload.title, completed: payload.completed }),
      );
    }),

  /** DELETE /orgs/:orgId/todos/:id — 204, or the contract's 404 shape. */
  delete: (outcome: { readonly result: "success" | "TodoNotFoundError" } = { result: "success" }) =>
    typedHandler(deleteEndpoint, () => {
      if (outcome.result === "TodoNotFoundError") {
        return Effect.fail(new TodosContract.TodoNotFoundError({ message: "Todo not found." }));
      }
      return Effect.void;
    }),
};
