import { makePresenterHarness } from "@/test/presenter-harness";
import { TodosContract } from "@org/contracts/api/Contracts";
import { TodoId } from "@org/contracts/EntityIds";
import { renderHook, waitFor } from "@testing-library/react";
import * as Effect from "effect/Effect";
import { afterEach, describe, expect, it } from "vitest";
import { useTodoListPresenter } from "./todo-list.presenter";

const mkTodo = (i: number): TodosContract.Todo =>
  new TodosContract.Todo({
    id: TodoId.make(`11111111-1111-1111-1111-${i.toString().padStart(12, "0")}`),
    title: `todo ${i}`,
    completed: false,
  });

const makeApiClient = (todos: ReadonlyArray<TodosContract.Todo>) => ({
  todos: {
    get: () => Effect.succeed(todos),
    create: () => Effect.die("not used"),
    update: () => Effect.die("not used"),
    delete: () => Effect.die("not used"),
  },
});

let harness: ReturnType<typeof makePresenterHarness>;

afterEach(async () => {
  await harness.dispose();
});

describe("useTodoListPresenter", () => {
  it("reports isEmpty=true when no todos are returned", async () => {
    harness = makePresenterHarness({ apiClient: makeApiClient([]) });
    const { result } = renderHook(() => useTodoListPresenter(), { wrapper: harness.wrapper });
    await waitFor(() => {
      expect(result.current.todos).toEqual([]);
    });
    expect(result.current.isEmpty).toBe(true);
  });

  it("exposes the loaded todos and isEmpty=false when populated", async () => {
    const todos = [mkTodo(1), mkTodo(2)];
    harness = makePresenterHarness({ apiClient: makeApiClient(todos) });
    const { result } = renderHook(() => useTodoListPresenter(), { wrapper: harness.wrapper });
    await waitFor(() => {
      expect(result.current.todos.length).toBe(2);
    });
    expect(result.current.isEmpty).toBe(false);
    expect(result.current.todos).toEqual(todos);
  });
});
