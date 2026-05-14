// Typed MSW handler wrapper. Threads an `HttpApiEndpoint` from
// `@org/contracts` through to MSW's `http.verb()` so test handlers
// describe an endpoint by reference, not by URL string. Contract drift
// becomes a `tsc` error.
//
// Scope: per-test, stateless. The resolver returns an `Effect` that
// either succeeds with the endpoint's success type or fails with one
// of its declared tagged errors. Status codes derive from
// `HttpApiSchema` annotations (`@effect/platform`) so the wire encoding
// matches what the real server does.

import type * as HttpApiEndpoint from "@effect/platform/HttpApiEndpoint";
import type * as HttpApiGroup from "@effect/platform/HttpApiGroup";
import * as HttpApiSchema from "@effect/platform/HttpApiSchema";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import {
  http,
  HttpResponse,
  type DefaultBodyType,
  type HttpHandler,
  type JsonBodyType,
  type StrictRequest,
} from "msw";

type JsonValue = JsonBodyType;

/**
 * Absolute base URL handlers register under. Tests use a matching base
 * on the `HttpApiClient` (e.g. `baseUrl: TEST_API_BASE`) so MSW node's
 * interceptor matches the request URL exactly. The real client uses a
 * relative `/api` against the same origin; tests can't be relative
 * because node's `fetch` requires an absolute URL.
 */
export const TEST_API_BASE = "http://localhost/api";

/**
 * `Group.endpoints` is typed as `Record<string, EndpointUnion>` — looking up
 * by name yields the union of all endpoints in the group, which loses the
 * concrete payload/path/error types for `typedHandler`. This helper narrows
 * the union by `name` so each call site sees only its endpoint's slot
 * types.
 */
export const getEndpoint = <G extends HttpApiGroup.HttpApiGroup.Any, Name extends string>(
  group: G,
  name: Name,
): Extract<HttpApiGroup.HttpApiGroup.Endpoints<G>, { readonly name: Name }> => {
  const eps = (group as unknown as HttpApiGroup.HttpApiGroup.AnyWithProps).endpoints as Record<
    string,
    HttpApiEndpoint.HttpApiEndpoint.Any | undefined
  >;
  const ep = eps[name];
  if (ep === undefined) {
    throw new Error(`No endpoint named "${name}" in group "${group.identifier}"`);
  }
  return ep as unknown as Extract<HttpApiGroup.HttpApiGroup.Endpoints<G>, { readonly name: Name }>;
};

/** Convert Effect's `HttpMethod` to MSW's `http.verb` accessor. */
const methodToHandler = {
  GET: http.get,
  POST: http.post,
  PUT: http.put,
  PATCH: http.patch,
  DELETE: http.delete,
  HEAD: http.head,
  OPTIONS: http.options,
} as const;

/**
 * Extract the resolver argument shape from an endpoint. Each schema is
 * conditionally present based on whether the endpoint declares it.
 * `Any` is the minimal interface the extractor types expect.
 */
type ResolverInput<E extends HttpApiEndpoint.HttpApiEndpoint.Any> = {
  readonly path: HttpApiEndpoint.HttpApiEndpoint.PathParsed<E>;
  readonly urlParams: HttpApiEndpoint.HttpApiEndpoint.UrlParams<E>;
  readonly payload: HttpApiEndpoint.HttpApiEndpoint.Payload<E>;
  readonly request: StrictRequest<DefaultBodyType>;
};

/** Effect the resolver returns: success or any declared tagged error. */
type ResolverEffect<E extends HttpApiEndpoint.HttpApiEndpoint.Any> = Effect.Effect<
  HttpApiEndpoint.HttpApiEndpoint.Success<E>,
  HttpApiEndpoint.HttpApiEndpoint.Error<E>
>;

type Resolver<E extends HttpApiEndpoint.HttpApiEndpoint.Any> = (
  input: ResolverInput<E>,
) => ResolverEffect<E>;

/**
 * Build an MSW handler for one endpoint. The URL is `TEST_API_BASE` +
 * the endpoint's path (e.g. `/users/:id`). Path/URL params/payload are
 * decoded against the endpoint's schemas; success and errors are
 * encoded with the corresponding schemas plus the status annotations
 * declared via `HttpApiSchema.annotations({ status })`.
 *
 * The function signature only requires the minimal `Any` interface
 * (concrete endpoints satisfy it trivially); we cast through `unknown`
 * to `AnyWithProps` inside to access the runtime properties. The
 * `AnyWithProps` interface in `@effect/platform` declares some
 * invariant generic slots, so it does NOT accept concrete endpoints
 * directly at call sites — this two-step cast is the workaround.
 */
export const typedHandler = <E extends HttpApiEndpoint.HttpApiEndpoint.Any>(
  endpoint: E,
  resolver: Resolver<E>,
): HttpHandler => {
  const ep = endpoint as unknown as HttpApiEndpoint.HttpApiEndpoint.AnyWithProps;
  const verb = methodToHandler[ep.method];
  // `ep.path` already includes the group's `.prefix(...)`, so we can
  // concatenate directly with the base URL.
  const fullPath = `${TEST_API_BASE}${ep.path}`;

  return verb(fullPath, async ({ params, request }) => {
    const url = new URL(request.url);

    const path = Option.isSome(ep.pathSchema)
      ? ((await decodeUnknown(
          ep.pathSchema.value as Schema.Schema.AnyNoContext,
          params,
        )) as HttpApiEndpoint.HttpApiEndpoint.PathParsed<E>)
      : ({} as HttpApiEndpoint.HttpApiEndpoint.PathParsed<E>);

    const urlParams = Option.isSome(ep.urlParamsSchema)
      ? ((await decodeUnknown(
          ep.urlParamsSchema.value as Schema.Schema.AnyNoContext,
          queryToRecord(url.searchParams),
        )) as HttpApiEndpoint.HttpApiEndpoint.UrlParams<E>)
      : ({} as HttpApiEndpoint.HttpApiEndpoint.UrlParams<E>);

    const payload = Option.isSome(ep.payloadSchema)
      ? ((await decodeUnknown(
          ep.payloadSchema.value as Schema.Schema.AnyNoContext,
          await request.json().catch(() => ({})),
        )) as HttpApiEndpoint.HttpApiEndpoint.Payload<E>)
      : ({} as HttpApiEndpoint.HttpApiEndpoint.Payload<E>);

    const exit = await Effect.runPromiseExit(resolver({ path, urlParams, payload, request }));

    if (Exit.isSuccess(exit)) {
      const successAst = (ep.successSchema as Schema.Schema.AnyNoContext).ast;
      const status = HttpApiSchema.getStatus(successAst, 200);
      const encoded = await encodeUnknown(
        ep.successSchema as Schema.Schema.AnyNoContext,
        exit.value,
      );
      return encoded === undefined
        ? new HttpResponse(null, { status })
        : HttpResponse.json(encoded as JsonValue, { status });
    }

    // Failure path. Surface the failure as the tagged-error JSON the
    // real server would emit. Defects (non-tagged) re-throw so the test
    // sees them as an unmocked exception rather than a 500.
    const failure = Cause.failureOption(exit.cause);
    if (Option.isNone(failure)) throw Cause.squash(exit.cause);

    const error = failure.value as { readonly _tag?: string; readonly constructor?: unknown };
    // A `Schema.TaggedError` class IS a `Schema`. The instance's
    // constructor is the variant the resolver failed with — use it
    // directly so the status annotation matches the variant, not the
    // union. Fall back to the declared union schema if the failure
    // wasn't a tagged class (shouldn't happen for well-typed
    // resolvers; covered for safety).
    const variantSchema =
      typeof error.constructor === "function" && "ast" in (error.constructor as object)
        ? (error.constructor as unknown as Schema.Schema.AnyNoContext)
        : (ep.errorSchema as Schema.Schema.AnyNoContext);
    const status = HttpApiSchema.getStatus(variantSchema.ast, 500);
    const encoded = await encodeUnknown(variantSchema, error);
    return HttpResponse.json(encoded as JsonValue, { status });
  });
};

// ----- helpers -----

const decodeUnknown = (schema: Schema.Schema.AnyNoContext, input: unknown) =>
  Effect.runPromise(Schema.decodeUnknown(schema)(input) as Effect.Effect<unknown, unknown, never>);

const encodeUnknown = (schema: Schema.Schema.AnyNoContext, value: unknown) =>
  Effect.runPromise(Schema.encodeUnknown(schema)(value) as Effect.Effect<unknown, unknown, never>);

const queryToRecord = (params: URLSearchParams): Record<string, string> => {
  const out: Record<string, string> = {};
  params.forEach((value, key) => {
    out[key] = value;
  });
  return out;
};
