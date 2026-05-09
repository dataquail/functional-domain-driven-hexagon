// Shared test wrapper for *.presenter.{ts,tsx} unit tests. Builds a
// fresh TanStack QueryClient and a per-test ManagedRuntime that
// substitutes FakeApiClient + RecordingToast for the prod ApiClient
// and sonner-backed Toast. Tests assert on toast calls via
// `getToasts()` and on QueryClient state via `queryClient`.

import { ApiClient } from "@/services/api-client.shared";
import { QueryClient } from "@/services/common/query-client";
import { RuntimeContext } from "@/services/runtime.client";
import { RecordedToasts, RecordingToast, type ToastCall } from "@/test/recording-toast";
import { QueryClientProvider, QueryClient as TanstackQueryClient } from "@tanstack/react-query";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as React from "react";

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

  // The opts.apiClient is the inner `client` substructure (e.g.
  // `{ todos: { ... }, user: { ... } }`); wrap it in `{ client: ... }`
  // to match the Tag's service shape. `as never` because callers pass
  // a partial mock typed as `Record<string, unknown>` — only the paths
  // the presenter under test reaches need to be filled in.
  const FakeApiClient = Layer.succeed(ApiClient, { client: opts.apiClient } as never);

  const layer = Layer.mergeAll(FakeApiClient, QueryClient.make(queryClient), RecordingToast);

  // Build a single runtime, then expose three distinct typings of it:
  // - `runtime` for the Context.Provider (cast to ClientManagedRuntime
  //   since RecordingToast carries the extra RecordedToasts service).
  // - `recordingRuntime` for `getToasts()` so the RecordedToasts read
  //   typechecks.
  // - `disposable` for `.dispose()` (any runtime can be disposed).
  const built = ManagedRuntime.make(layer);
  const runtime = built as unknown as React.ContextType<typeof RuntimeContext>;
  const recordingRuntime = built as unknown as ManagedRuntime.ManagedRuntime<RecordedToasts, never>;

  const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <RuntimeContext.Provider value={runtime}>{children}</RuntimeContext.Provider>
    </QueryClientProvider>
  );

  return {
    wrapper,
    queryClient,
    getToasts: () => recordingRuntime.runPromise(Effect.flatMap(RecordedToasts, (rec) => rec.all)),
    dispose: () => built.dispose(),
  };
};
