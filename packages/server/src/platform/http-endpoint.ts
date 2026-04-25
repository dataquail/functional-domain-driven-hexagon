import type * as HttpApiEndpoint from "@effect/platform/HttpApiEndpoint";
import type * as HttpApiGroup from "@effect/platform/HttpApiGroup";

// Derives the typed request envelope ({ path, urlParams, payload, headers })
// for a named endpoint within a contract group. Keeps endpoint signatures in
// sync with the contract automatically — adding a new field to the endpoint
// declaration flows through to the implementation file's parameter type.
export type EndpointRequest<
  G extends HttpApiGroup.HttpApiGroup.Any,
  Name extends string,
> = HttpApiEndpoint.HttpApiEndpoint.Request<
  HttpApiEndpoint.HttpApiEndpoint.WithName<HttpApiGroup.HttpApiGroup.Endpoints<G>, Name>
>;
