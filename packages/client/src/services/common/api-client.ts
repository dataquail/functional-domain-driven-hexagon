import { envVars } from "@/lib/env-vars";
import * as FetchHttpClient from "@effect/platform/FetchHttpClient";
import * as HttpApiClient from "@effect/platform/HttpApiClient";
import * as HttpClient from "@effect/platform/HttpClient";
import { DomainApi } from "@org/contracts/DomainApi";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

// Always send cookies with API requests. Required so the BFF session
// cookie travels with every call. Same-origin requests would also send
// cookies by default, but `include` is correct for both same-origin and
// cross-origin in case API_URL is pointed somewhere other than the SPA's
// own origin (e.g., dev pointed straight at :3000 without the Vite proxy).
const FetchWithCredentials = FetchHttpClient.layer.pipe(
  Layer.provide(Layer.succeed(FetchHttpClient.RequestInit, { credentials: "include" })),
);

export class ApiClient extends Effect.Service<ApiClient>()("ApiClient", {
  accessors: true,
  dependencies: [FetchWithCredentials],
  effect: Effect.gen(function* () {
    return {
      client: yield* HttpApiClient.make(DomainApi, {
        baseUrl: envVars.API_URL.toString(),
        transformClient: (client) => client.pipe(HttpClient.retryTransient({ times: 3 })),
      }),
    };
  }),
}) {}
