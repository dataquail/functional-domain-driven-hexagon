import { ApiClient } from "@/services/common/api-client";
import { NetworkMonitor } from "@/services/common/network-monitor";
import { QueryClient } from "@/services/common/query-client";
import { Toast } from "@/services/common/toast";
import { type LiveManagedRuntime } from "@/services/live-layer";
import { RuntimeProvider } from "@/services/runtime/runtime-provider";
import { WorkerClient } from "@/services/worker/worker-client";
import { QueryClient as TanstackQueryClient } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import type * as Scope from "effect/Scope";
import * as SubscriptionRef from "effect/SubscriptionRef";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useViewModel, type ViewModel } from "./view-model";

// Stub layers — `useViewModel` requires a runtime typed as `LiveManagedRuntime`,
// but the test VMs below don't actually consume any of these services. Stubs
// satisfy the type without doing real work.
const StubLiveLayer = Layer.mergeAll(
  Layer.succeed(ApiClient, {} as unknown as ApiClient),
  Layer.succeed(NetworkMonitor, {} as unknown as NetworkMonitor),
  QueryClient.make(new TanstackQueryClient()),
  Layer.succeed(Toast, {} as unknown as Toast),
  Layer.succeed(WorkerClient, {} as unknown as WorkerClient),
);

let testRuntime: LiveManagedRuntime;

beforeEach(() => {
  testRuntime = ManagedRuntime.make(StubLiveLayer);
});

afterEach(async () => {
  await testRuntime.dispose();
});

const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <RuntimeProvider runtime={testRuntime}>{children}</RuntimeProvider>
);

// ── Counter VM (parameterless + parameterized actions) ────────────────────
type CounterState = { readonly count: number };
type CounterActions = {
  readonly increment: Effect.Effect<void>;
  readonly addAmount: (amount: number) => Effect.Effect<void>;
};

const makeCounter: Effect.Effect<ViewModel<CounterState, CounterActions>> = Effect.gen(
  function* () {
    const state = yield* SubscriptionRef.make<CounterState>({ count: 0 });
    return {
      state,
      actions: {
        increment: SubscriptionRef.update(state, (s) => ({ count: s.count + 1 })),
        addAmount: (amount: number) =>
          SubscriptionRef.update(state, (s) => ({ count: s.count + amount })),
      },
    };
  },
);

describe("useViewModel", () => {
  it("returns the seeded initial state on first render, then settles to the VM's state", async () => {
    const { result } = renderHook(() => useViewModel(makeCounter, { count: -1 }), { wrapper });

    expect(result.current.state).toEqual({ count: -1 });

    await waitFor(() => {
      expect(result.current.state).toEqual({ count: 0 });
    });
  });

  it("wraps parameterless Effect actions and propagates state updates", async () => {
    const { result } = renderHook(() => useViewModel(makeCounter, { count: -1 }), { wrapper });
    await waitFor(() => {
      expect(result.current.state).toEqual({ count: 0 });
    });

    act(() => {
      result.current.actions.increment();
    });
    await waitFor(() => {
      expect(result.current.state).toEqual({ count: 1 });
    });

    act(() => {
      result.current.actions.increment();
    });
    await waitFor(() => {
      expect(result.current.state).toEqual({ count: 2 });
    });
  });

  it("wraps parameterized function actions", async () => {
    const { result } = renderHook(() => useViewModel(makeCounter, { count: -1 }), { wrapper });
    await waitFor(() => {
      expect(result.current.state).toEqual({ count: 0 });
    });

    act(() => {
      result.current.actions.addAmount(5);
    });
    await waitFor(() => {
      expect(result.current.state).toEqual({ count: 5 });
    });

    act(() => {
      result.current.actions.addAmount(10);
    });
    await waitFor(() => {
      expect(result.current.state).toEqual({ count: 15 });
    });
  });

  it("runs scope finalizers when the hook unmounts", async () => {
    let finalized = false;
    const makeWithFinalizer: Effect.Effect<
      ViewModel<{ readonly tag: "ready" }, Record<string, never>>,
      never,
      Scope.Scope
    > = Effect.gen(function* () {
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          finalized = true;
        }),
      );
      const state = yield* SubscriptionRef.make<{ readonly tag: "ready" }>({ tag: "ready" });
      return { state, actions: {} };
    });

    const { result, unmount } = renderHook(
      () => useViewModel(makeWithFinalizer, { tag: "ready" } as const),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.state).toEqual({ tag: "ready" });
    });

    unmount();

    await waitFor(() => {
      expect(finalized).toBe(true);
    });
  });

  it("treats action calls before the VM is ready as no-ops (does not throw)", () => {
    const { result } = renderHook(() => useViewModel(makeCounter, { count: -1 }), { wrapper });

    expect(() => {
      result.current.actions.increment();
    }).not.toThrow();
    expect(result.current.state).toEqual({ count: -1 });
  });
});
