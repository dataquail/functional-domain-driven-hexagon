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

import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as HttpClient from "effect/unstable/http/HttpClient";
import { cookies } from "next/headers";
import React from "react";

import { ApiClientLive } from "./api-client.server";
import { type ApiClient } from "./api-client.shared";

// `@vercel/otel` (instrumentation.ts) owns trace-context propagation on the
// Next server: it auto-instruments `fetch` and injects one consistent W3C
// `traceparent` from the active request context, so browser → Next → BFF is a
// single trace (ADR-0012). Effect's own `HttpClient` would ALSO inject its
// per-call span as a `b3` header — a second, conflicting context on the same
// request. The BFF honors `traceparent`, so that `b3` is dead weight that only
// muddies the headers. Disable Effect's propagation so `@vercel/otel` is the
// sole source of truth.
const NoEffectTracePropagation = Layer.succeed(HttpClient.TracerPropagationEnabled, false);

export const getServerRuntime = React.cache(async () => {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  return ManagedRuntime.make(Layer.merge(ApiClientLive(cookieHeader), NoEffectTracePropagation));
});

export type ServerRuntime = ManagedRuntime.ManagedRuntime<ApiClient, never>;
