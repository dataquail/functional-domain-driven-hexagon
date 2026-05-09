"use client";

// Browser-side Effect runtime, mirrored on the existing SPA's pattern in
// packages/client/src/services/runtime/. Singleton-per-tab: one
// ManagedRuntime survives across re-renders so cached resources (the
// HttpApiClient instance, fetch retry transformers) aren't rebuilt on
// every paint. `useRuntime()` exposes it to client hooks like
// `useEffectSuspenseQuery` and `useEffectMutation`.
//
// Layers:
// - ApiClient — talks to the BFF through the same-origin /api proxy
// - Toast — sonner-backed surface used by useEffectMutation's runner
// - QueryClient — the same instance the QueryClientProvider holds, so
//   data-access mutation invalidation paths (query-data-helpers.ts)
//   target the same cache the components read from.

import { QueryClient } from "@/services/common/query-client";
import { Toast } from "@/services/common/toast";
import { WebSdkLive } from "@/services/common/web-sdk.client";
import { type QueryClient as TanstackQueryClient } from "@tanstack/react-query";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as React from "react";
import { ApiClientLive } from "./api-client.client";

// `WebSdkLive` is `provide`d (not `mergeAll`'d): it satisfies the
// `Tracer` requirement of the inner layers and erases that requirement
// from the resulting runtime context. Inner layers emit spans against
// the active tracer; the SDK ships them OTLP/HTTP to the Jaeger
// collector. Browser-originated spans propagate `traceparent` on
// outbound `/api/*` fetches, so Jaeger stitches browser → Next →
// Effect into a single trace.
const buildClientLive = (queryClient: TanstackQueryClient) =>
  Layer.mergeAll(ApiClientLive, Toast.Default, QueryClient.make(queryClient)).pipe(
    Layer.provide(WebSdkLive),
  );

export type ClientManagedRuntime = ManagedRuntime.ManagedRuntime<
  Layer.Layer.Success<ReturnType<typeof buildClientLive>>,
  never
>;

export type ClientRuntimeContext = ManagedRuntime.ManagedRuntime.Context<ClientManagedRuntime>;

const RuntimeContext = React.createContext<ClientManagedRuntime | null>(null);

export const RuntimeProvider: React.FC<{
  children: React.ReactNode;
  queryClient: TanstackQueryClient;
}> = ({ children, queryClient }) => {
  const runtime = React.useMemo(
    () => ManagedRuntime.make(buildClientLive(queryClient)),
    [queryClient],
  );

  // Dispose on unmount-after-mount only. React Strict Mode mounts twice
  // in dev; disposing on the first cleanup would tear the cached
  // resources down before any consumer reads them.
  const mountRef = React.useRef(false);
  React.useEffect(() => {
    if (!mountRef.current) {
      mountRef.current = true;
      return undefined;
    }
    return () => {
      void runtime.dispose();
    };
  }, [runtime]);

  return <RuntimeContext.Provider value={runtime}>{children}</RuntimeContext.Provider>;
};

export const useRuntime = (): ClientManagedRuntime => {
  const runtime = React.useContext(RuntimeContext);
  if (runtime === null) throw new Error("useRuntime must be used within a RuntimeProvider");
  return runtime;
};
