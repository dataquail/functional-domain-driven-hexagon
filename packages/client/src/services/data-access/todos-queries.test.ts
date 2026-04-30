import { ApiClient } from "@/services/common/api-client";
import { QueryClient } from "@/services/common/query-client";
import { TodosQueries } from "@/services/data-access/todos-queries";
import { TodosContract } from "@org/contracts/api/Contracts";
import { TodoId } from "@org/contracts/EntityIds";
import { QueryClient as TanstackQueryClient } from "@tanstack/react-query";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Pure cache + protocol tests for TodosQueries. These cover the frontend-only
// logic that server integration tests and Playwright specs don't exercise:
//   - cache update functions (setData) inside createTodo/updateTodo/deleteTodo
//   - optimistic-id pending set lifecycle (Effect.scoped finalizer)
//   - SSE event handler (TodosQueries.stream): dedup against pending
//     optimistic ids; replace-by-id on existing entries; remove on
//     DeletedTodo
// The fake ApiClient lets us assert what calls were made and control return
// values; the real TanStack QueryClient lets us inspect cache state directly.

const makeTodo = (id: string, overrides?: Partial<TodosContract.Todo>): TodosContract.Todo =>
  new TodosContract.Todo({
    id: TodoId.make(id),
    title: overrides?.title ?? `Todo ${id}`,
    completed: overrides?.completed ?? false,
  });

const aliceId = TodoId.make("11111111-1111-1111-1111-111111111111");
const bobId = TodoId.make("22222222-2222-2222-2222-222222222222");
const carolId = TodoId.make("33333333-3333-3333-3333-333333333333");

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
  // Override callbacks may consult the harness's `ApiClient` and `QueryClient`
  // layers — the SSE-race test, for example, drives a Stream through the live
  // QueryClient mid-create — so the requirement set is widened beyond the
  // default `Effect.Effect<A>`.
  readonly create?: (
    payload: TodosContract.CreateTodoPayload,
  ) => Effect.Effect<TodosContract.Todo, never, ApiClient | QueryClient>;
  readonly update?: (
    payload: TodosContract.UpdateTodoPayload,
  ) => Effect.Effect<TodosContract.Todo, never, ApiClient | QueryClient>;
  readonly remove?: (id: TodoId) => Effect.Effect<void, never, ApiClient | QueryClient>;
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
      unsafeClient: {},
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

const cacheState = (queryClient: TanstackQueryClient): ReadonlyArray<TodosContract.Todo> =>
  queryClient.getQueryData<ReadonlyArray<TodosContract.Todo>>(TODOS_KEY) ?? [];

let harness: Harness;

beforeEach(() => {
  harness = makeHarness();
});

afterEach(() => {
  harness.queryClient.clear();
});

describe("TodosQueries.createTodo", () => {
  it("calls the API with the title plus a generated optimistic id, and adds the result to the cache", async () => {
    harness.primeCache([]);

    const created = await harness.run(TodosQueries.createTodo({ title: "Buy milk" }));

    expect(harness.apiCalls.create).toHaveLength(1);
    const sentPayload = harness.apiCalls.create[0];
    expect(sentPayload?.title).toBe("Buy milk");
    expect(typeof sentPayload?.optimisticId).toBe("string");
    expect((sentPayload?.optimisticId ?? "").length).toBeGreaterThan(0);

    const cache = cacheState(harness.queryClient);
    expect(cache).toHaveLength(1);
    expect(cache[0]?.id).toBe(created.id);
    expect(cache[0]?.title).toBe("Buy milk");
  });

  it("unshifts the created todo to the front of the cache (newest-first ordering)", async () => {
    const existing = [makeTodo(aliceId, { title: "Old A" }), makeTodo(bobId, { title: "Old B" })];
    harness.primeCache(existing);

    const created = await harness.run(TodosQueries.createTodo({ title: "New" }));

    const cache = cacheState(harness.queryClient);
    expect(cache).toHaveLength(3);
    expect(cache[0]?.id).toBe(created.id);
    expect(cache[1]?.id).toBe(aliceId);
    expect(cache[2]?.id).toBe(bobId);
  });

  it("does not double-add when the id is already in the cache (race with SSE upsert)", async () => {
    const racingId = TodoId.make("99999999-9999-9999-9999-999999999999");
    const harnessLocal = makeHarness({
      create: () => Effect.succeed(makeTodo(racingId, { title: "Buy milk" })),
    });
    harnessLocal.primeCache([makeTodo(racingId, { title: "Buy milk (from SSE)" })]);

    await harnessLocal.run(TodosQueries.createTodo({ title: "Buy milk" }));

    const cache = cacheState(harnessLocal.queryClient);
    expect(cache).toHaveLength(1);
    expect(cache[0]?.id).toBe(racingId);
  });

  it("does nothing to the cache when it has not been primed (setData is a no-op on missing data)", async () => {
    // No primeCache call — the query has never been read, so the cache slot
    // is undefined and setData should not synthesize an entry.
    await harness.run(TodosQueries.createTodo({ title: "Solo" }));

    const cache = harness.queryClient.getQueryData<ReadonlyArray<TodosContract.Todo>>(TODOS_KEY);
    expect(cache).toBeUndefined();
  });
});

describe("TodosQueries.updateTodo", () => {
  it("calls the API with the full payload and replaces the cache entry by id", async () => {
    const original = makeTodo(aliceId, { title: "Old title", completed: false });
    harness.primeCache([original, makeTodo(bobId, { title: "Other" })]);

    const updated = TodosContract.UpdateTodoPayload.make({
      id: aliceId,
      title: "New title",
      completed: true,
    });
    await harness.run(TodosQueries.updateTodo(updated));

    expect(harness.apiCalls.update).toHaveLength(1);
    expect(harness.apiCalls.update[0]?.id).toBe(aliceId);

    const cache = cacheState(harness.queryClient);
    expect(cache).toHaveLength(2);
    expect(cache.find((t) => t.id === aliceId)?.title).toBe("New title");
    expect(cache.find((t) => t.id === aliceId)?.completed).toBe(true);
    expect(cache.find((t) => t.id === bobId)?.title).toBe("Other");
  });

  it("leaves the cache unchanged when the id isn't present", async () => {
    harness.primeCache([makeTodo(bobId, { title: "Bob" })]);

    const ghost = TodosContract.UpdateTodoPayload.make({
      id: aliceId,
      title: "Ghost",
      completed: false,
    });
    await harness.run(TodosQueries.updateTodo(ghost));

    const cache = cacheState(harness.queryClient);
    expect(cache).toHaveLength(1);
    expect(cache[0]?.id).toBe(bobId);
  });
});

describe("TodosQueries.deleteTodo", () => {
  it("calls the API with the id and removes the cache entry", async () => {
    harness.primeCache([
      makeTodo(aliceId, { title: "Alice" }),
      makeTodo(bobId, { title: "Bob" }),
      makeTodo(carolId, { title: "Carol" }),
    ]);

    await harness.run(TodosQueries.deleteTodo(bobId));

    expect(harness.apiCalls.remove).toEqual([bobId]);
    const cache = cacheState(harness.queryClient);
    expect(cache.map((t) => t.id)).toEqual([aliceId, carolId]);
  });

  it("leaves the cache unchanged when the id isn't present", async () => {
    harness.primeCache([makeTodo(bobId, { title: "Bob" })]);

    await harness.run(TodosQueries.deleteTodo(aliceId));

    const cache = cacheState(harness.queryClient);
    expect(cache).toHaveLength(1);
    expect(cache[0]?.id).toBe(bobId);
  });
});

describe("TodosQueries.stream (SSE handler)", () => {
  // Drive the handler by piping a finite Stream of SseContract.Events through
  // it. Stream.runDrain returns once all events have been processed, so we
  // can inspect the cache deterministically after the call resolves.
  const drive = (
    events: ReadonlyArray<
      TodosContract.SseEvents.UpsertedTodo | TodosContract.SseEvents.DeletedTodo
    >,
    h: Harness,
  ) => h.run(TodosQueries.stream(Stream.fromIterable(events)).pipe(Stream.runDrain));

  it("UpsertedTodo unshifts a new todo into the cache when the id isn't present", async () => {
    harness.primeCache([makeTodo(aliceId)]);

    const event = new TodosContract.SseEvents.UpsertedTodo({
      todo: makeTodo(bobId, { title: "From SSE" }),
    });
    await drive([event], harness);

    const cache = cacheState(harness.queryClient);
    expect(cache).toHaveLength(2);
    expect(cache[0]?.id).toBe(bobId);
    expect(cache[1]?.id).toBe(aliceId);
  });

  it("UpsertedTodo replaces an existing entry by id rather than duplicating", async () => {
    harness.primeCache([makeTodo(aliceId, { title: "Old", completed: false }), makeTodo(bobId)]);

    const event = new TodosContract.SseEvents.UpsertedTodo({
      todo: makeTodo(aliceId, { title: "Updated", completed: true }),
    });
    await drive([event], harness);

    const cache = cacheState(harness.queryClient);
    expect(cache).toHaveLength(2);
    const alice = cache.find((t) => t.id === aliceId);
    expect(alice?.title).toBe("Updated");
    expect(alice?.completed).toBe(true);
  });

  it("DeletedTodo removes the entry from the cache", async () => {
    harness.primeCache([makeTodo(aliceId), makeTodo(bobId), makeTodo(carolId)]);

    const event = new TodosContract.SseEvents.DeletedTodo({ id: bobId });
    await drive([event], harness);

    const cache = cacheState(harness.queryClient);
    expect(cache.map((t) => t.id)).toEqual([aliceId, carolId]);
  });

  it("UpsertedTodo with a pending optimistic id is skipped (race-free local-mutation path)", async () => {
    // Run a createTodo concurrently so its scope is open (the optimistic id
    // sits in `pendingOptimisticIds`) when the SSE event arrives carrying
    // the same id. The SSE handler must skip; the local mutation is the
    // source of truth.
    const harnessLocal = makeHarness({
      create: (payload: TodosContract.CreateTodoPayload) =>
        Effect.gen(function* () {
          // Hold the create scope open long enough for the SSE event to
          // race in. The create's own setData runs after this Effect
          // resolves, so any cache state observed here is from the SSE
          // path alone.
          expect(payload.optimisticId).toBeDefined();

          if (payload.optimisticId !== undefined) {
            const sseEvent = new TodosContract.SseEvents.UpsertedTodo({
              todo: makeTodo(aliceId, { title: payload.title }),
              optimisticId: payload.optimisticId,
            });
            yield* TodosQueries.stream(Stream.make(sseEvent)).pipe(Stream.runDrain);
          }

          return makeTodo(aliceId, { title: payload.title });
        }),
    });
    harnessLocal.primeCache([]);

    await harnessLocal.run(TodosQueries.createTodo({ title: "Buy milk" }));

    // Exactly one entry — the SSE event was skipped because the optimistic
    // id was still pending; the createTodo's own setData added it once.
    const cache = cacheState(harnessLocal.queryClient);
    expect(cache).toHaveLength(1);
    expect(cache[0]?.id).toBe(aliceId);
  });

  it("UpsertedTodo with a stale optimistic id (pending set already cleared) is applied normally", async () => {
    // A late SSE event arrives after the create scope has already finalized
    // and cleared its optimistic id. The dedup check must be `pending.has(id)`
    // at event time — not at create time — so this event applies.
    harness.primeCache([]);

    // First run a complete createTodo so its finalizer clears the pending id.
    const created = await harness.run(TodosQueries.createTodo({ title: "First" }));
    const optimisticIdSent = harness.apiCalls.create[0]?.optimisticId;
    expect(optimisticIdSent).toBeDefined();

    // Now drive an SSE event referencing that same optimistic id; since
    // the pending set has been cleared, it should NOT be skipped — it
    // applies, and the dedup-by-id check inside the handler keeps the
    // cache at one entry.
    const lateEvent = new TodosContract.SseEvents.UpsertedTodo({
      todo: makeTodo(created.id, { title: "First (echo)" }),
      optimisticId: optimisticIdSent,
    });
    await drive([lateEvent], harness);

    const cache = cacheState(harness.queryClient);
    expect(cache).toHaveLength(1);
    expect(cache[0]?.title).toBe("First (echo)");
  });
});
