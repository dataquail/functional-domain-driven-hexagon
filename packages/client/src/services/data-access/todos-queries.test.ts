import { ApiClient } from "@/services/common/api-client";
import { QueryClient } from "@/services/common/query-client";
import { TodosQueries } from "@/services/data-access/todos-queries";
import { TodosContract } from "@org/contracts/api/Contracts";
import { TodoId } from "@org/contracts/EntityIds";
import { QueryClient as TanstackQueryClient } from "@tanstack/react-query";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// TodosQueries mutations invalidate the list cache after the API call
// succeeds. The list query is keyed by ["todos"], so any cached value must be
// marked stale once a mutation lands so TanStack Query refetches it.

const makeTodo = (id: string, overrides?: Partial<TodosContract.Todo>): TodosContract.Todo =>
  new TodosContract.Todo({
    id: TodoId.make(id),
    title: overrides?.title ?? `Todo ${id}`,
    completed: overrides?.completed ?? false,
  });

const aliceId = TodoId.make("11111111-1111-1111-1111-111111111111");
const bobId = TodoId.make("22222222-2222-2222-2222-222222222222");

const TODOS_KEY = ["todos"] as const;

type ApiCalls = {
  create: Array<TodosContract.CreateTodoPayload>;
  update: Array<TodosContract.UpdateTodoPayload>;
  remove: Array<TodoId>;
};

type Harness = {
  readonly run: <A, E>(self: Effect.Effect<A, E, ApiClient | QueryClient>) => Promise<A>;
  readonly queryClient: TanstackQueryClient;
  readonly apiCalls: ApiCalls;
  readonly primeCache: (todos: ReadonlyArray<TodosContract.Todo>) => void;
};

const makeHarness = (overrides?: {
  readonly create?: (payload: TodosContract.CreateTodoPayload) => Effect.Effect<TodosContract.Todo>;
  readonly update?: (payload: TodosContract.UpdateTodoPayload) => Effect.Effect<TodosContract.Todo>;
  readonly remove?: (id: TodoId) => Effect.Effect<void>;
}): Harness => {
  const queryClient = new TanstackQueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  const apiCalls: ApiCalls = { create: [], update: [], remove: [] };

  const FakeApi = Layer.succeed(
    ApiClient,
    ApiClient.of({
      client: {
        todos: {
          get: () => Effect.succeed([] as ReadonlyArray<TodosContract.Todo>),
          create: (args: { payload: TodosContract.CreateTodoPayload }) => {
            apiCalls.create.push(args.payload);
            return overrides?.create !== undefined
              ? overrides.create(args.payload)
              : Effect.succeed(
                  makeTodo(crypto.randomUUID(), {
                    title: args.payload.title,
                    completed: false,
                  }),
                );
          },
          update: (args: { payload: TodosContract.UpdateTodoPayload }) => {
            apiCalls.update.push(args.payload);
            return overrides?.update !== undefined
              ? overrides.update(args.payload)
              : Effect.succeed(makeTodo(args.payload.id, args.payload));
          },
          delete: (args: { payload: TodoId }) => {
            apiCalls.remove.push(args.payload);
            return overrides?.remove !== undefined ? overrides.remove(args.payload) : Effect.void;
          },
        },
      },
    } as unknown as ApiClient),
  );

  const layer = Layer.mergeAll(FakeApi, QueryClient.make(queryClient));

  return {
    run: <A, E>(self: Effect.Effect<A, E, ApiClient | QueryClient>) =>
      Effect.runPromise(self.pipe(Effect.provide(layer))),
    queryClient,
    apiCalls,
    primeCache: (todos) => {
      queryClient.setQueryData(TODOS_KEY, todos);
    },
  };
};

let harness: Harness;

beforeEach(() => {
  harness = makeHarness();
});

afterEach(() => {
  harness.queryClient.clear();
});

describe("TodosQueries.createTodo", () => {
  it("calls the API with the title and returns the created todo", async () => {
    const created = await harness.run(TodosQueries.createTodo({ title: "Buy milk" }));

    expect(harness.apiCalls.create).toHaveLength(1);
    expect(harness.apiCalls.create[0]?.title).toBe("Buy milk");
    expect(created.title).toBe("Buy milk");
  });

  it("invalidates the cached todos list after a successful create", async () => {
    harness.primeCache([makeTodo(aliceId)]);

    expect(harness.queryClient.getQueryState(TODOS_KEY)?.isInvalidated).not.toBe(true);

    await harness.run(TodosQueries.createTodo({ title: "Buy milk" }));

    expect(harness.queryClient.getQueryState(TODOS_KEY)?.isInvalidated).toBe(true);
  });
});

describe("TodosQueries.updateTodo", () => {
  it("calls the API with the full payload and returns the updated todo", async () => {
    const payload = TodosContract.UpdateTodoPayload.make({
      id: aliceId,
      title: "New title",
      completed: true,
    });

    const updated = await harness.run(TodosQueries.updateTodo(payload));

    expect(harness.apiCalls.update).toHaveLength(1);
    expect(harness.apiCalls.update[0]?.id).toBe(aliceId);
    expect(updated.title).toBe("New title");
  });

  it("invalidates the cached todos list after a successful update", async () => {
    harness.primeCache([makeTodo(aliceId, { title: "Old" })]);

    expect(harness.queryClient.getQueryState(TODOS_KEY)?.isInvalidated).not.toBe(true);

    await harness.run(
      TodosQueries.updateTodo(
        TodosContract.UpdateTodoPayload.make({
          id: aliceId,
          title: "New",
          completed: true,
        }),
      ),
    );

    expect(harness.queryClient.getQueryState(TODOS_KEY)?.isInvalidated).toBe(true);
  });
});

describe("TodosQueries.deleteTodo", () => {
  it("calls the API with the id", async () => {
    await harness.run(TodosQueries.deleteTodo(bobId));

    expect(harness.apiCalls.remove).toEqual([bobId]);
  });

  it("invalidates the cached todos list after a successful delete", async () => {
    harness.primeCache([makeTodo(aliceId), makeTodo(bobId)]);

    expect(harness.queryClient.getQueryState(TODOS_KEY)?.isInvalidated).not.toBe(true);

    await harness.run(TodosQueries.deleteTodo(bobId));

    expect(harness.queryClient.getQueryState(TODOS_KEY)?.isInvalidated).toBe(true);
  });
});
