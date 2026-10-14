import { CliApi } from "@org/contracts/CliApi";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import * as Option from "effect/Option";

const withBearer = (token: string) => (client: HttpClient.HttpClient) =>
  client.pipe(
    HttpClient.mapRequest(HttpClientRequest.setHeader("Authorization", `Bearer ${token}`)),
  );

// Builds the typed client over `CliApi` (ADR-0005). When a token is present
// it's injected as `Authorization: Bearer …`; the device-auth endpoints are
// public, so a tokenless client is valid for `auth login`.
//
// Returns an Effect requiring `HttpClient` — the caller provides the
// transport (the CLI/MCP wire `FetchHttpClient.layer`).
export const makeCliClient = (opts: {
  readonly baseUrl: string;
  readonly token: Option.Option<string>;
}) =>
  Option.match(opts.token, {
    onNone: () => HttpApiClient.make(CliApi, { baseUrl: opts.baseUrl }),
    onSome: (token) =>
      HttpApiClient.make(CliApi, { baseUrl: opts.baseUrl, transformClient: withBearer(token) }),
  });
