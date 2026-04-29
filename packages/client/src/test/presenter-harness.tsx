import { ApiClient } from "@/services/common/api-client";
import { NetworkMonitor } from "@/services/common/network-monitor";
import { QueryClient } from "@/services/common/query-client";
import { type LiveManagedRuntime } from "@/services/live-layer";
import { RuntimeProvider } from "@/services/runtime/runtime-provider";
import { WorkerClient } from "@/services/worker/worker-client";
import { RecordedToasts, RecordingToast, type ToastCall } from "@/test/recording-toast";
import { QueryClientProvider, QueryClient as TanstackQueryClient } from "@tanstack/react-query";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as React from "react";

// Shared test wrapper for *.presenter.tsx tests. Provides a fresh TanStack
// QueryClient + a ManagedRuntime with a stubbed ApiClient and the recording
// Toast so tests can assert success/error toast calls. Stub Layers cover
// NetworkMonitor and WorkerClient because the runtime type requires them but
// presenter tests don't exercise them.

export type PresenterHarness = {
  readonly wrapper: React.FC<{ children: React.ReactNode }>;
  readonly queryClient: TanstackQueryClient;
  readonly getToasts: () => Promise<ReadonlyArray<ToastCall>>;
  readonly dispose: () => Promise<void>;
};

export const makePresenterHarness = (opts: {
  readonly apiClient: Record<string, unknown>;
}): PresenterHarness => {
  const queryClient = new TanstackQueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  const FakeApiClient = Layer.succeed(
    ApiClient,
    ApiClient.of({
      client: opts.apiClient,
      unsafeClient: {},
    } as unknown as ApiClient),
  );

  const layer = Layer.mergeAll(
    FakeApiClient,
    QueryClient.make(queryClient),
    RecordingToast,
    Layer.succeed(NetworkMonitor, {} as unknown as NetworkMonitor),
    Layer.succeed(WorkerClient, {} as unknown as WorkerClient),
  );

  // The runtime carries Toast + RecordedToasts (from RecordingToast) plus the
  // four Live services. The cast hides RecordedToasts from RuntimeProvider's
  // expected `LiveManagedRuntime` shape; tests that need the recorded log
  // call `getToasts()` below, which knows the actual context.
  const runtime = ManagedRuntime.make(layer);

  const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <RuntimeProvider runtime={runtime as unknown as LiveManagedRuntime}>
        {children}
      </RuntimeProvider>
    </QueryClientProvider>
  );

  return {
    wrapper,
    queryClient,
    getToasts: () => runtime.runPromise(Effect.flatMap(RecordedToasts, (rec) => rec.all)),
    dispose: () => runtime.dispose(),
  };
};
