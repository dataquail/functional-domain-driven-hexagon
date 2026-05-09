// Shared ApiClient tag. Both runtimes (server prefetch, browser
// useSuspenseQuery) provide a layer that satisfies this tag, so a
// data-access Effect like `UsersQueries.usersQuery({...})` runs in
// either context unchanged. The runtime decides the transport —
// server-side hits SERVER_INTERNAL_URL with the inbound cookie
// injected; client-side hits the relative `/api` proxy path.
//
// Layers live in `api-client.{server,client}.ts`. This file is
// intentionally environment-agnostic — no `import "server-only"`, no
// `next/headers`, no browser globals.

import type * as HttpApi from "@effect/platform/HttpApi";
import type * as HttpApiClient from "@effect/platform/HttpApiClient";
import { type DomainApi } from "@org/contracts/DomainApi";
import * as Context from "effect/Context";

// Unwrap the inferred HttpApiClient client shape for `typeof DomainApi`.
// `HttpApiClient.make` returns `Client<Groups, ApiError, never>`, but
// `Client` is parametric over Groups/Err/R, not over the whole HttpApi
// — pull the parts back out with conditional inference so the tag's
// value type stays in sync with the contract automatically.
type ClientShape<TApi> =
  TApi extends HttpApi.HttpApi<infer _Id, infer Groups, infer Err, infer _R>
    ? HttpApiClient.Client<Groups, Err, never>
    : never;

// `Context.Tag`'s class self-reference is the canonical Effect pattern; the
// recursion is purely type-level (the class IS the tag identity).
/* eslint-disable no-use-before-define */
export class ApiClient extends Context.Tag("@org/web/ApiClient")<
  ApiClient,
  { readonly client: ClientShape<typeof DomainApi> }
>() {}
/* eslint-enable no-use-before-define */
