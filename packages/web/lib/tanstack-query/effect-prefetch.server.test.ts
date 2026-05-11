// Tests for `prefetchEffectQuery`. The interesting behavior is the
// JSON round-trip that strips `Schema.Class` prototypes before the
// dehydrated cache crosses the RSC/CC boundary, plus the contract with
// TanStack's `prefetchQuery` (which swallows errors by design).
//
// `server-only` and the per-request server modules are mocked because
// jsdom is not an RSC context; the production wiring lives in
// `getServerRuntime` / `getQueryClient` and is not what we're exercising here.

import { QueryClient as TanstackQueryClient } from "@tanstack/react-query";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prefetchEffectQuery } from "./effect-prefetch.server";

vi.mock("server-only", () => ({}));

const sharedQueryClient = new TanstackQueryClient({
  defaultOptions: {
    queries: { retry: false, gcTime: 0 },
    mutations: { retry: false },
  },
});

vi.mock("@/lib/query-client.server", () => ({
  getQueryClient: () => sharedQueryClient,
}));

vi.mock("@/services/runtime.server", () => ({
  getServerRuntime: async () => ({
    runPromise: <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect),
  }),
}));

class TodoLike extends Schema.Class<TodoLike>("TodoLike")({
  id: Schema.String,
  title: Schema.String,
}) {}

beforeEach(() => {
  sharedQueryClient.clear();
});

describe("prefetchEffectQuery", () => {
  it("populates the cache with a plain object — Schema.Class prototype is stripped", async () => {
    const key = ["todo-prefetch", "plain-object"] as const;
    const instance = new TodoLike({ id: "1", title: "Buy milk" });
    expect(instance).toBeInstanceOf(TodoLike);

    await prefetchEffectQuery({
      queryKey: key,
      queryFn: Effect.succeed(instance),
    });

    const cached = sharedQueryClient.getQueryData<TodoLike>(key);
    expect(cached).toBeDefined();
    // Same enumerable shape ...
    expect(cached).toEqual({ id: "1", title: "Buy milk" });
    // ... but no class marker — round-trip stripped the prototype.
    expect(cached).not.toBeInstanceOf(TodoLike);
    expect(Object.getPrototypeOf(cached)).toBe(Object.prototype);
  });

  it("leaves the cache empty when the underlying effect fails (prefetchQuery swallows errors)", async () => {
    const key = ["todo-prefetch", "failed"] as const;

    await prefetchEffectQuery({
      queryKey: key,
      queryFn: Effect.fail(new Error("boom")),
    });

    expect(sharedQueryClient.getQueryData(key)).toBeUndefined();
  });

  it("leaves the cache empty when the effect defects", async () => {
    const key = ["todo-prefetch", "died"] as const;

    await prefetchEffectQuery({
      queryKey: key,
      queryFn: Effect.die("kaboom"),
    });

    expect(sharedQueryClient.getQueryData(key)).toBeUndefined();
  });
});
