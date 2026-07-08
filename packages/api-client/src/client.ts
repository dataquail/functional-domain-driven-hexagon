import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import { CliApi } from "@org/contracts/CliApi";

// Builds the typed client over `CliApi` (ADR-0024). When a token is present
// it's injected as `Authorization: Bearer …`; the device-auth endpoints are
// public, so a tokenless client is valid for `auth login`.
//
// Returns an Effect requiring `HttpClient` — the caller provides the
// transport (the CLI/MCP wire `FetchHttpClient.layer`).
export const makeCliClient = (opts: { readonly baseUrl: string; readonly token: string | null }) =>
  HttpApiClient.make(CliApi, {
    baseUrl: opts.baseUrl,
    transformClient:
      opts.token === null
        ? undefined
        : (client) =>
            client.pipe(
              HttpClient.mapRequest(
                HttpClientRequest.setHeader("Authorization", `Bearer ${opts.token}`),
              ),
            ),
  });
