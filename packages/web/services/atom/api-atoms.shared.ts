// The Model: the whole HTTP surface as atoms.
//
// `ApiAtoms.query(group, endpoint, request)` yields an `Atom<AsyncResult<A, E>>`
// memoised on the request, and `ApiAtoms.mutation(group, endpoint)` yields an
// `AtomResultFn` whose `reactivityKeys` refresh every query declaring the same
// key. That pair replaces the query-key/invalidation bookkeeping wholesale --
// the contract is the single source of truth for both channels.

import { DomainApi } from "@org/contracts/DomainApi";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import * as AtomHttpApi from "effect/unstable/reactivity/AtomHttpApi";

import { type ApiTransport, apiTransportAtom } from "./api-transport.shared";

const FetchWithCredentials = FetchHttpClient.layer.pipe(
  Layer.provide(Layer.succeed(FetchHttpClient.RequestInit, { credentials: "include" })),
);

// The base URL is prepended here rather than passed as the service's `baseUrl`
// option, because that option is fixed at definition time and the transport is
// not.
const transportLayer = (transport: ApiTransport): Layer.Layer<HttpClient.HttpClient> =>
  Layer.effect(
    HttpClient.HttpClient,
    Effect.map(HttpClient.HttpClient, (client) =>
      client.pipe(
        HttpClient.mapRequest(HttpClientRequest.prependUrl(transport.baseUrl)),
        HttpClient.mapRequest(HttpClientRequest.setHeaders(transport.headers)),
      ),
    ),
  ).pipe(Layer.provide(FetchWithCredentials));

export class ApiAtoms extends AtomHttpApi.Service<ApiAtoms>()("ApiAtoms", {
  api: DomainApi,
  httpClient: (get) => transportLayer(get(apiTransportAtom)),
  transformClient: (client) => client.pipe(HttpClient.retryTransient({ times: 3 })),
}) {}
