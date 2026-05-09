"use client";

// Browser-side Effect runtime, mirrored on the existing SPA's pattern in
// packages/client/src/services/runtime/. Singleton-per-tab: one
// ManagedRuntime survives across re-renders so cached resources (the
// HttpApiClient instance, fetch retry transformers) aren't rebuilt on
// every paint. `useRuntime()` exposes it to client hooks like
// `useEffectSuspenseQuery`.
//
// Phase 4 ships a minimal layer set (just ApiClient). NetworkMonitor,
// Toast, WorkerClient — all client-only — port over from the existing
// SPA in later phases as their consumers land.

import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as React from "react";
import { ApiClientLive } from "./api-client.client";

const ClientLive = Layer.mergeAll(ApiClientLive);

export type ClientManagedRuntime = ManagedRuntime.ManagedRuntime<
  Layer.Layer.Success<typeof ClientLive>,
  never
>;

export type ClientRuntimeContext = ManagedRuntime.ManagedRuntime.Context<ClientManagedRuntime>;

const RuntimeContext = React.createContext<ClientManagedRuntime | null>(null);

export const RuntimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const runtime = React.useMemo(() => ManagedRuntime.make(ClientLive), []);

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
