// The server's per-request runtime and the browser's each provide this tag, so a
// Model Effect runs in either unchanged.

import { type DomainApi } from "@org/contracts/DomainApi";
import * as Context from "effect/Context";
import type * as HttpApiClient from "effect/http-api/HttpApiClient";

// Unwrap the inferred HttpApiClient client shape for `typeof DomainApi`.
// `HttpApiClient.make` returns `Client<Groups>`; `ForApi` pulls the
// Groups back out of the whole HttpApi so the tag's value type stays in
// sync with the contract automatically.
type ClientShape = HttpApiClient.ForApi<typeof DomainApi>;

// `Context.Tag`'s class self-reference is the canonical Effect pattern; the
// recursion is purely type-level (the class IS the tag identity).
/* eslint-disable no-use-before-define */
export class ApiClient extends Context.Service<ApiClient, { readonly client: ClientShape }>()(
  "@org/web/ApiClient",
) {}
/* eslint-enable no-use-before-define */
