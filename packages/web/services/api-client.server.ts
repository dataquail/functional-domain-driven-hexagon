// Server-side ApiClient layer. Provides the shared `ApiClient` tag
// (services/api-client.shared.ts) by talking to the Effect server
// directly via the internal URL — NOT through Next's `/api/*` rewrite,
// which is for browser traffic. The inbound `Cookie` header from the
// browser request is read via `next/headers` and forwarded on every
// outbound call so the Effect server's session middleware sees the
// same session the browser would.
//
// `import "server-only"` makes Next throw at build time if this module
// is pulled into a client component — the cookie-reading side effect
// must never ship to the browser.

import "server-only";

import * as FetchHttpClient from "@effect/platform/FetchHttpClient";
import * as HttpApiClient from "@effect/platform/HttpApiClient";
import * as HttpClient from "@effect/platform/HttpClient";
import * as HttpClientRequest from "@effect/platform/HttpClientRequest";
import { DomainApi } from "@org/contracts/DomainApi";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { ApiClient } from "./api-client.shared";

const SERVER_INTERNAL_URL = process.env.SERVER_INTERNAL_URL ?? "http://localhost:3001";

// Build a request-scoped ApiClient layer. The cookie string is captured
// at construction; one ManagedRuntime per request keeps cookies from
// leaking across requests.
export const ApiClientLive = (cookieHeader: string) =>
  Layer.effect(
    ApiClient,
    Effect.gen(function* () {
      const client = yield* HttpApiClient.make(DomainApi, {
        baseUrl: SERVER_INTERNAL_URL,
        transformClient: (c) =>
          c.pipe(
            HttpClient.mapRequest((req) =>
              cookieHeader.length > 0
                ? HttpClientRequest.setHeader(req, "Cookie", cookieHeader)
                : req,
            ),
            HttpClient.retryTransient({ times: 3 }),
          ),
      });
      return ApiClient.of({ client });
    }),
  ).pipe(Layer.provide(FetchHttpClient.layer));
