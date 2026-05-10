import { makePresenterHarness } from "@/test/presenter-harness";
import { TodosContract } from "@org/contracts/api/Contracts";
import { TodoId } from "@org/contracts/EntityIds";
import { act, renderHook, waitFor } from "@testing-library/react";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import { afterEach, describe, expect, it } from "vitest";
import { useTodoItemPresenter } from "./todo-item.presenter";

class TodoNotFoundError extends Data.TaggedError("TodoNotFoundError")<{
  readonly todoId: string;
  readonly message: string;
}> {}

const mkTodo = (overrides: Partial<TodosContract.Todo> = {}) =>
  new TodosContract.Todo({
    id: TodoId.make("11111111-1111-1111-1111-111111111111"),
    title: "Buy milk",
    completed: false,
    ...overrides,
  });

type UpdateCalls = ReadonlyArray<TodosContract.Todo>;
type DeleteCalls = ReadonlyArray<TodoId>;

const makeApiClient = (opts?: {
  readonly update?: (payload: TodosContract.Todo) => Effect.Effect<TodosContract.Todo>;
  readonly delete?: (id: TodoId) => Effect.Effect<void, TodoNotFoundError>;
  readonly updateCalls?: { current: UpdateCalls };
  readonly deleteCalls?: { current: DeleteCalls };
}) => ({
  todos: {
    get: () => Effect.succeed([] as ReadonlyArray<TodosContract.Todo>),
    create: () => Effect.die("not used"),
    update: (args: { payload: TodosContract.Todo }) => {
      if (opts?.updateCalls !== undefined) {
        opts.updateCalls.current = [...opts.updateCalls.current, args.payload];
      }
      return opts?.update?.(args.payload) ?? Effect.succeed(args.payload);
    },
    delete: (args: { payload: TodoId }) => {
      if (opts?.deleteCalls !== undefined) {
        opts.deleteCalls.current = [...opts.deleteCalls.current, args.payload];
      }
      return opts?.delete?.(args.payload) ?? Effect.void;
    },
  },
});

let harness: ReturnType<typeof makePresenterHarness>;

afterEach(async () => {
  await harness.dispose();
});

describe("useTodoItemPresenter — toggleCompleted", () => {
  it("dispatches an update with completed flipped from false → true", async () => {
    const updateCalls: { current: UpdateCalls } = { current: [] };
    harness = makePresenterHarness({ apiClient: makeApiClient({ updateCalls }) });
    const todo = mkTodo({ completed: false });

    const { result } = renderHook(() => useTodoItemPresenter(todo), { wrapper: harness.wrapper });

    act(() => {
      result.current.toggleCompleted();
    });

    await waitFor(() => {
      expect(updateCalls.current).toHaveLength(1);
    });
    expect(updateCalls.current[0]?.completed).toBe(true);
  });

  it("dispatches an update with completed flipped from true → false", async () => {
    const updateCalls: { current: UpdateCalls } = { current: [] };
    harness = makePresenterHarness({ apiClient: makeApiClient({ updateCalls }) });
    const todo = mkTodo({ completed: true });

    const { result } = renderHook(() => useTodoItemPresenter(todo), { wrapper: harness.wrapper });

    act(() => {
      result.current.toggleCompleted();
    });

    await waitFor(() => {
      expect(updateCalls.current).toHaveLength(1);
    });
    expect(updateCalls.current[0]?.completed).toBe(false);
  });
});

describe("useTodoItemPresenter — deleteThis", () => {
  it("dispatches a delete keyed by the todo id", async () => {
    const deleteCalls: { current: DeleteCalls } = { current: [] };
    harness = makePresenterHarness({ apiClient: makeApiClient({ deleteCalls }) });
    const todo = mkTodo();

    const { result } = renderHook(() => useTodoItemPresenter(todo), { wrapper: harness.wrapper });

    act(() => {
      result.current.deleteThis();
    });

    await waitFor(() => {
      expect(deleteCalls.current).toEqual([todo.id]);
    });
  });

  it("surfaces a tagged delete failure via toast", async () => {
    harness = makePresenterHarness({
      apiClient: makeApiClient({
        delete: (id) => Effect.fail(new TodoNotFoundError({ todoId: id, message: "not found" })),
      }),
    });
    const todo = mkTodo();

    const { result } = renderHook(() => useTodoItemPresenter(todo), { wrapper: harness.wrapper });

    act(() => {
      result.current.deleteThis();
    });

    await waitFor(async () => {
      const toasts = await harness.getToasts();
      expect(toasts).toContainEqual({ kind: "error", message: "not found" });
    });
  });
});
