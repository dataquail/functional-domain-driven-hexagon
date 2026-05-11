// Integration harness for FE tests that drive the real backend
// handlers in-process via `@org/test-backend`. Mounts components
// against a runtime whose `ApiClient` is wired to the in-process
// backend's `fetch` function — same request/response objects the
// browser would see, no network, no port, no codegen.
//
// Pair with `rtlUsersDriver(rendered, { getToasts })` to write
// integration specs that mirror the acceptance specs' phrasing
// (Phase 9 worked example).

import { ApiClient } from "@/services/api-client.shared";
import { QueryClient } from "@/services/common/query-client";
import { RuntimeContext } from "@/services/runtime.client";
import { RecordedToasts, RecordingToast, type ToastCall } from "@/test/recording-toast";
import * as FetchHttpClient from "@effect/platform/FetchHttpClient";
import * as HttpApiClient from "@effect/platform/HttpApiClient";
import { DomainApi } from "@org/contracts/DomainApi";
import { QueryClientProvider, QueryClient as TanstackQueryClient } from "@tanstack/react-query";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as React from "react";

export type IntegrationHarness = {
  readonly wrapper: React.FC<{ children: React.ReactNode }>;
  readonly queryClient: TanstackQueryClient;
  readonly getToasts: () => Promise<ReadonlyArray<ToastCall>>;
  readonly dispose: () => Promise<void>;
};

// Build an integration harness wired to the in-process backend.
// `transport` is `backend.fetch` from `startInProcessBackend()`.
export const makeIntegrationHarness = (opts: {
  readonly transport: typeof fetch;
}): IntegrationHarness => {
  const queryClient = new TanstackQueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  // The HttpApiClient wired to `opts.transport` — Effect builds a
  // typed client (`client.user.find`, `client.todos.create`, …)
  // whose calls go through fetch with the in-process backend as
  // the transport. The base URL is arbitrary; the in-process
  // handler ignores it and routes by path.
  const HttpClientLive = FetchHttpClient.layer.pipe(
    Layer.provide(Layer.succeed(FetchHttpClient.Fetch, opts.transport)),
  );

  const ApiClientLive = Layer.effect(
    ApiClient,
    Effect.gen(function* () {
      const client = yield* HttpApiClient.make(DomainApi, {
        baseUrl: "http://in-process.test",
      });
      return ApiClient.of({ client });
    }),
  ).pipe(Layer.provide(HttpClientLive));

  const layer = Layer.mergeAll(ApiClientLive, QueryClient.make(queryClient), RecordingToast);
  const built = ManagedRuntime.make(layer);
  const runtime = built as unknown as React.ContextType<typeof RuntimeContext>;
  const recordingRuntime = built as unknown as ManagedRuntime.ManagedRuntime<RecordedToasts, never>;

  const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <RuntimeContext.Provider value={runtime}>
        <React.Suspense fallback={<span data-testid="integration-suspense-fallback" />}>
          {children}
        </React.Suspense>
      </RuntimeContext.Provider>
    </QueryClientProvider>
  );

  return {
    wrapper,
    queryClient,
    getToasts: () => recordingRuntime.runPromise(Effect.flatMap(RecordedToasts, (rec) => rec.all)),
    dispose: () => built.dispose(),
  };
};
