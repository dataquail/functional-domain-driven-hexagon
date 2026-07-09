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

import { type DomainApi } from "@org/contracts/DomainApi";
import * as Context from "effect/Context";
import type * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";

// Unwrap the inferred HttpApiClient client shape for `typeof DomainApi`.
// `HttpApiClient.make` returns `Client<Groups>`; `ForApi` pulls the
// Groups back out of the whole HttpApi so the tag's value type stays in
// sync with the contract automatically.
type ClientShape = HttpApiClient.ForApi<typeof DomainApi>;

// `Context.Tag`'s class self-reference is the canonical Effect pattern; the
// recursion is purely type-level (the class IS the tag identity).
/* eslint-disable no-use-before-define */
export class ApiClient extends Context.Service<ApiClient, { readonly client: ClientShape }>()("@org/web/ApiClient") {}
/* eslint-enable no-use-before-define */
