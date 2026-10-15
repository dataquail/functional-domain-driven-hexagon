// The server's per-request runtime and the browser's each provide this tag, so a
// Model Effect runs in either unchanged.

import { type DomainApi } from "@org/contracts/DomainApi";
import * as Context from "effect/Context";
import type * as HttpApiClient from "effect/http-api/HttpApiClient";

// Unwrap the inferred HttpApiClient client shape for `typeof DomainApi`.
// `HttpApiClient.make` returns `Client<Groups>`; `ForApi` pulls the
// Groups back out of the whole HttpApi so the tag's value type stays in
// sync with the contract automatically.
type DomainApiClient = HttpApiClient.ForApi<typeof DomainApi>;

/* eslint-disable no-use-before-define -- a service class names itself as its own tag; the recursion is type-level */
export class ApiClient extends Context.Service<ApiClient, { readonly client: DomainApiClient }>()(
  "@org/web/ApiClient",
) {}
/* eslint-enable no-use-before-define */
