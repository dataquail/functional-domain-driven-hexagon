// Server-side ApiClient layer. Provides the shared `ApiClient` tag by calling
// the Effect server Worker directly over its service binding -- not through
// the `/api` proxy, which is for browser traffic -- with the inbound `Cookie`
// header forwarded so the server's session middleware sees the browser's
// session.

import { DomainApi } from "@org/contracts/DomainApi";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import * as Layer from "effect/Layer";

import { ApiClient } from "./api-client.shared";

// A service binding ignores the host; the URL only carries the path.
const SERVER_ORIGIN = "http://server";

const forwardCookie = (
  request: HttpClientRequest.HttpClientRequest,
  cookieHeader: string,
): HttpClientRequest.HttpClientRequest => {
  if (cookieHeader.length === 0) return request;

  return HttpClientRequest.setHeader(request, "Cookie", cookieHeader);
};

export const ApiClientLive = (fetch: typeof globalThis.fetch, cookieHeader: string) =>
  Layer.effect(
    ApiClient,
    Effect.gen(function* () {
      const client = yield* HttpApiClient.make(DomainApi, {
        baseUrl: SERVER_ORIGIN,
        transformClient: (c) =>
          c.pipe(
            HttpClient.mapRequest((req) => forwardCookie(req, cookieHeader)),
            HttpClient.retryTransient({ times: 3 }),
          ),
      });

      return ApiClient.of({ client });
    }),
  ).pipe(
    Layer.provide(
      FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch))),
    ),
  );
