import { makePresenterHarness } from "@/test/presenter-harness";
import { TodosContract } from "@org/contracts/api/Contracts";
import { TodoId } from "@org/contracts/EntityIds";
import { act, renderHook, waitFor } from "@testing-library/react";
import * as Effect from "effect/Effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAddTodoPresenter } from "./add-todo.presenter";

type CreateCalls = ReadonlyArray<TodosContract.CreateTodoPayload>;

const makeApiClient = (opts?: {
  readonly create?: (payload: TodosContract.CreateTodoPayload) => Effect.Effect<TodosContract.Todo>;
  readonly recordedCalls?: { current: CreateCalls };
}) => {
  const create =
    opts?.create ??
    ((payload) =>
      Effect.succeed(
        new TodosContract.Todo({
          id: TodoId.make("11111111-1111-1111-1111-111111111111"),
          title: payload.title,
          completed: false,
        }),
      ));

  return {
    todos: {
      get: () => Effect.succeed([] as ReadonlyArray<TodosContract.Todo>),
      create: (args: { payload: TodosContract.CreateTodoPayload }) => {
        if (opts?.recordedCalls !== undefined) {
          opts.recordedCalls.current = [...opts.recordedCalls.current, args.payload];
        }
        return create(args.payload);
      },
    },
  };
};

let harness: ReturnType<typeof makePresenterHarness>;

beforeEach(() => {
  harness = makePresenterHarness({ apiClient: makeApiClient() });
});

afterEach(async () => {
  await harness.dispose();
});

describe("useAddTodoPresenter", () => {
  it("submits a valid title, calls the create mutation, and resets the form", async () => {
    const recorded: { current: CreateCalls } = { current: [] };
    harness = makePresenterHarness({ apiClient: makeApiClient({ recordedCalls: recorded }) });

    const { result } = renderHook(() => useAddTodoPresenter(), { wrapper: harness.wrapper });

    act(() => {
      result.current.form.setFieldValue("title", "Buy milk");
    });

    await act(async () => {
      await result.current.form.handleSubmit();
    });

    expect(recorded.current).toHaveLength(1);
    expect(recorded.current[0]?.title).toBe("Buy milk");

    await waitFor(() => {
      expect(result.current.form.state.values.title).toBe("");
    });

    const toasts = await harness.getToasts();
    expect(toasts).toEqual([{ kind: "success", message: "Todo created!" }]);
  });

  it("surfaces a field error and does not call the mutation on invalid submit", async () => {
    const recorded: { current: CreateCalls } = { current: [] };
    harness = makePresenterHarness({ apiClient: makeApiClient({ recordedCalls: recorded }) });

    const { result } = renderHook(() => useAddTodoPresenter(), { wrapper: harness.wrapper });

    await act(async () => {
      await result.current.form.handleSubmit();
    });

    expect(recorded.current).toHaveLength(0);
    expect(result.current.form.state.errorMap.onSubmit?.title).toBeDefined();
  });

  it("emits a default error toast and keeps the form value when the mutation fails", async () => {
    const failingApi = makeApiClient({
      create: () => Effect.die("boom"),
    });
    harness = makePresenterHarness({ apiClient: failingApi });

    const { result } = renderHook(() => useAddTodoPresenter(), { wrapper: harness.wrapper });

    act(() => {
      result.current.form.setFieldValue("title", "Buy milk");
    });

    const handleSubmit = vi.fn(result.current.form.handleSubmit);
    await act(async () => {
      try {
        await handleSubmit();
      } catch {
        /* mutateAsync throws on failure; presenter swallows via toast adapter */
      }
    });

    expect(result.current.form.state.values.title).toBe("Buy milk");

    const toasts = await harness.getToasts();
    expect(toasts.length).toBe(1);
    expect(toasts[0]?.kind).toBe("error");
  });
});
