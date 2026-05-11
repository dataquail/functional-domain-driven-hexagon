// Tests for `useEffectSuspenseQuery`. The bridge surface is:
//   - success path: hook returns the resolved value
//   - tagged failure: thrown synchronously into the nearest error boundary
//   - defect: wrapped in QueryDefect and thrown
//   - cache hit: hydrated value is read without invoking the runtime

import { ApiClient } from "@/services/api-client.shared";
import { QueryClient } from "@/services/common/query-client";
import { type ClientManagedRuntime, RuntimeContext } from "@/services/runtime.client";
import { RecordingToast } from "@/test/recording-toast";
import { QueryClientProvider, QueryClient as TanstackQueryClient } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryDefect } from "./use-effect-mutation";
import { useEffectSuspenseQuery } from "./use-effect-suspense-query";

class TaggedA extends Data.TaggedError("TaggedA")<{ readonly message: string }> {}

type SuspenseHarness = {
  readonly wrapper: React.FC<{ children: React.ReactNode }>;
  readonly queryClient: TanstackQueryClient;
  readonly dispose: () => Promise<void>;
};

const makeSuspenseHarness = (): SuspenseHarness => {
  const queryClient = new TanstackQueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: Infinity },
      mutations: { retry: false },
    },
  });

  const FakeApiClient = Layer.succeed(ApiClient, { client: {} } as never);
  const layer = Layer.mergeAll(FakeApiClient, QueryClient.make(queryClient), RecordingToast);
  const built = ManagedRuntime.make(layer);
  const runtime = built as unknown as ClientManagedRuntime;

  const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <RuntimeContext.Provider value={runtime}>
        <React.Suspense fallback={<span data-testid="loading" />}>{children}</React.Suspense>
      </RuntimeContext.Provider>
    </QueryClientProvider>
  );

  return { wrapper, queryClient, dispose: () => built.dispose() };
};

const makeFailingRuntimeHarness = (): SuspenseHarness => {
  const queryClient = new TanstackQueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: Infinity },
      mutations: { retry: false },
    },
  });

  // A runtime whose runPromiseExit throws — proves the cache-hit path
  // does not invoke the runtime at all.
  const throwingRuntime = {
    runPromiseExit: () => {
      throw new Error("runtime should not be invoked when the QueryClient has a cached entry");
    },
  } as unknown as ClientManagedRuntime;

  const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <RuntimeContext.Provider value={throwingRuntime}>
        <React.Suspense fallback={<span data-testid="loading" />}>{children}</React.Suspense>
      </RuntimeContext.Provider>
    </QueryClientProvider>
  );

  return { wrapper, queryClient, dispose: () => Promise.resolve() };
};

let harness: SuspenseHarness;

afterEach(async () => {
  await harness.dispose();
});

describe("useEffectSuspenseQuery — success", () => {
  it("returns the resolved value once the effect completes", async () => {
    harness = makeSuspenseHarness();

    const { result } = renderHook(
      () =>
        useEffectSuspenseQuery({
          queryKey: ["suspense-success"],
          queryFn: () => Effect.succeed({ value: 7 }),
        }),
      { wrapper: harness.wrapper },
    );

    await waitFor(() => {
      expect(result.current.data).toEqual({ value: 7 });
    });
  });
});

const makeCatchingBoundary = () => {
  const caught: { current: unknown } = { current: null };
  class Boundary extends React.Component<
    { readonly children: React.ReactNode },
    { readonly hasError: boolean }
  > {
    public override state = { hasError: false };
    public static getDerivedStateFromError() {
      return { hasError: true };
    }
    public override componentDidCatch(error: unknown) {
      caught.current = error;
    }
    public override render() {
      if (this.state.hasError) return <span data-testid="boundary" />;
      return this.props.children;
    }
  }
  return { Boundary, caught };
};

describe("useEffectSuspenseQuery — tagged failure", () => {
  it("throws the tagged error so it reaches the nearest error boundary", async () => {
    harness = makeSuspenseHarness();

    // React logs caught errors via console.error in dev; silence it.
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { Boundary, caught } = makeCatchingBoundary();
    const wrappedWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <harness.wrapper>
        <Boundary>{children}</Boundary>
      </harness.wrapper>
    );

    renderHook(
      () =>
        useEffectSuspenseQuery({
          queryKey: ["suspense-tagged-failure"],
          queryFn: () => Effect.fail(new TaggedA({ message: "nope" })),
        }),
      { wrapper: wrappedWrapper },
    );

    await waitFor(() => {
      expect(caught.current).not.toBeNull();
    });
    expect(caught.current).toBeInstanceOf(TaggedA);

    spy.mockRestore();
  });
});

describe("useEffectSuspenseQuery — defect", () => {
  it("wraps a defect in QueryDefect", async () => {
    harness = makeSuspenseHarness();

    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { Boundary, caught } = makeCatchingBoundary();
    const wrappedWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <harness.wrapper>
        <Boundary>{children}</Boundary>
      </harness.wrapper>
    );

    renderHook(
      () =>
        useEffectSuspenseQuery({
          queryKey: ["suspense-defect"],
          queryFn: () => Effect.die("kaboom"),
        }),
      { wrapper: wrappedWrapper },
    );

    await waitFor(() => {
      expect(caught.current).not.toBeNull();
    });
    expect(caught.current).toBeInstanceOf(QueryDefect);

    spy.mockRestore();
  });
});

describe("useEffectSuspenseQuery — cache hit", () => {
  it("reads from a pre-seeded QueryClient without invoking the runtime", async () => {
    harness = makeFailingRuntimeHarness();
    harness.queryClient.setQueryData(["cached-key"], { cached: true });

    const { result } = renderHook(
      () =>
        useEffectSuspenseQuery({
          queryKey: ["cached-key"],
          queryFn: () => Effect.succeed({ cached: false }),
        }),
      { wrapper: harness.wrapper },
    );

    await waitFor(() => {
      expect(result.current.data).toEqual({ cached: true });
    });
  });
});
