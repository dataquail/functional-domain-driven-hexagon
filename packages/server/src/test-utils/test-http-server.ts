import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpEffect from "effect/http/HttpEffect";
import * as HttpServer from "effect/http/HttpServer";
import type * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as NetAddress from "effect/net/NetAddress";
import type * as Scope from "effect/Scope";

type WebHandler = (request: Request) => Promise<Response>;

const ORIGIN = "http://in-memory.test";

const notServing: WebHandler = HttpEffect.toWebHandler(
  Effect.succeed(
    HttpServerResponse.text("The in-memory server is not serving anything yet", { status: 503 }),
  ),
);

// An HttpServer that listens on nothing: what it is told to serve becomes a Web
// handler, and the HttpClient beside it calls that handler as its fetch — the
// way the Worker serves the same application, with no socket in between.
export const InMemoryHttpServerLive = Layer.unwrap(
  Effect.sync(() => {
    let handler: WebHandler = notServing;

    const server = HttpServer.make({
      address: NetAddress.inetAddressUnsafe(NetAddress.ipv4Loopback, 0),
      serve: (httpEffect, middleware) =>
        Effect.gen(function* () {
          const context = yield* Effect.context<Scope.Scope>();
          handler = HttpEffect.toWebHandlerWith<
            Scope.Scope,
            Scope.Scope | HttpServerRequest.HttpServerRequest
          >(context)(httpEffect, middleware);
        }),
    });

    const fetchServed: typeof globalThis.fetch = (input, init) => handler(new Request(input, init));

    const client = Layer.effect(
      HttpClient.HttpClient,
      Effect.gen(function* () {
        const fetchClient = yield* HttpClient.HttpClient;

        return HttpClient.mapRequest(fetchClient, HttpClientRequest.prependUrl(ORIGIN));
      }),
    ).pipe(
      Layer.provide(FetchHttpClient.layer),
      Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetchServed)),
    );

    return Layer.merge(Layer.succeed(HttpServer.HttpServer, server), client).pipe(
      Layer.provideMerge(HttpServer.layerServices),
    );
  }),
);
