// Per-request `ManagedRuntime` for server components and route handlers.
// `React.cache` memoizes within a single render scope, so every server
// component in a request shares the same runtime — and importantly, no
// runtime (and no captured cookie) leaks across requests.
//
// The layer set is a strict subset of the client runtime: no
// WorkerClient, no Toast, no NetworkMonitor, no browser WebSdk. Phase 5
// adds Node-side OTEL via `instrumentation.ts`, which is wired at the
// Next process boundary rather than per-request.
import "server-only";

import * as ManagedRuntime from "effect/ManagedRuntime";
import { cookies } from "next/headers";
import { cache } from "react";
import { type ApiClient, ApiClientLive } from "./api-client.server";

export const getServerRuntime = cache(async () => {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  return ManagedRuntime.make(ApiClientLive(cookieHeader));
});

export type ServerRuntime = ManagedRuntime.ManagedRuntime<ApiClient, never>;
