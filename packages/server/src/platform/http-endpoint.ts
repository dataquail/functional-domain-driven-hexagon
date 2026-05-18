import type * as HttpApiEndpoint from "@effect/platform/HttpApiEndpoint";
import type * as HttpApiGroup from "@effect/platform/HttpApiGroup";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import * as Effect from "effect/Effect";

import { type PersistenceUnavailable } from "@/platform/ddd/persistence-unavailable.js";

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

// Standard endpoint translation for the transient-store signal. Every
// endpoint that calls a use case ends up with `PersistenceUnavailable`
// in its effect's error channel; this helper folds that into the
// `ServiceUnavailable` contract error so the SPA sees a clean 503.
//
// Usage: `.pipe(recoverPersistenceUnavailable)` at the end of the endpoint
// `Effect.gen`. The endpoint's typed error channel becomes
// `... | CustomHttpApiError.ServiceUnavailable`, which the contract
// group must declare via `addError(ServiceUnavailable)`.
//
// `catchTag` on a generic union channel resists inference cleanly, so
// the implementation does the catch on the widened type then re-asserts
// the narrowed result. The single cast is contained here so callers
// stay clean.
export const recoverPersistenceUnavailable: <A, E, R>(
  effect: Effect.Effect<A, E | PersistenceUnavailable, R>,
) => Effect.Effect<
  A,
  Exclude<E, PersistenceUnavailable> | CustomHttpApiError.ServiceUnavailable,
  R
> = <A, E, R>(effect: Effect.Effect<A, E | PersistenceUnavailable, R>) =>
  Effect.catchTag(
    effect as Effect.Effect<A, PersistenceUnavailable, R>,
    "PersistenceUnavailable",
    (e: PersistenceUnavailable) =>
      Effect.fail(new CustomHttpApiError.ServiceUnavailable({ message: e.message })),
  ) as Effect.Effect<
    A,
    Exclude<E, PersistenceUnavailable> | CustomHttpApiError.ServiceUnavailable,
    R
  >;
