"use client";

// Browser-side ApiClient layer. Provides the shared `ApiClient` tag
// (services/api-client.shared.ts) by talking to the Effect server
// through Next's `/api/*` rewrite, so `baseUrl` is relative and the
// request is same-origin from the browser's perspective. The session
// cookie is scoped to the Next origin and rides automatically — no
// `credentials: "include"` needed (kept as belt-and-suspenders).
//
// This is the symmetric companion to `api-client.server.ts` — same
// `DomainApi` contract, same `HttpApiClient`, different transport: the
// server variant talks to `SERVER_INTERNAL_URL` directly with the
// inbound cookie injected; this variant talks to a relative path with
// the browser's cookie jar handling attachment.

import * as FetchHttpClient from "@effect/platform/FetchHttpClient";
import * as HttpApiClient from "@effect/platform/HttpApiClient";
import * as HttpClient from "@effect/platform/HttpClient";
import { DomainApi } from "@org/contracts/DomainApi";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { ApiClient } from "./api-client.shared";

const FetchWithCredentials = FetchHttpClient.layer.pipe(
  Layer.provide(Layer.succeed(FetchHttpClient.RequestInit, { credentials: "include" })),
);

export const ApiClientLive = Layer.effect(
  ApiClient,
  Effect.gen(function* () {
    const client = yield* HttpApiClient.make(DomainApi, {
      baseUrl: "/api",
      transformClient: (c) => c.pipe(HttpClient.retryTransient({ times: 3 })),
    });
    return ApiClient.of({ client });
  }),
).pipe(Layer.provide(FetchWithCredentials));
