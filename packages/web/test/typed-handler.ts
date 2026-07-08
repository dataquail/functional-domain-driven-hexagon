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

import type * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import type * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
import {
  type DefaultBodyType,
  http,
  type HttpHandler,
  HttpResponse,
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
export const getEndpoint = <G extends HttpApiGroup.Any, Name extends string>(
  group: G,
  name: Name,
): Extract<HttpApiGroup.Endpoints<G>, { readonly name: Name }> => {
  const eps = (group as unknown as HttpApiGroup.AnyWithProps).endpoints as Record<
    string,
    HttpApiEndpoint.Any | undefined
  >;
  const ep = eps[name];
  if (ep === undefined) {
    throw new Error(`No endpoint named "${name}" in group "${group.identifier}"`);
  }
  return ep as unknown as Extract<HttpApiGroup.Endpoints<G>, { readonly name: Name }>;
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
type ResolverInput<E extends HttpApiEndpoint.Any> = {
  readonly path: HttpApiEndpoint.Params<E>["Type"];
  readonly urlParams: HttpApiEndpoint.Query<E>["Type"];
  readonly payload: HttpApiEndpoint.Payload<E>["Type"];
  readonly request: StrictRequest<DefaultBodyType>;
};

/** Effect the resolver returns: success or any declared tagged error. */
type ResolverEffect<E extends HttpApiEndpoint.Any> = Effect.Effect<
  HttpApiEndpoint.Success<E>["Type"],
  HttpApiEndpoint.Error<E>["Type"]
>;

type Resolver<E extends HttpApiEndpoint.Any> = (
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
export const typedHandler = <E extends HttpApiEndpoint.Any>(
  endpoint: E,
  resolver: Resolver<E>,
): HttpHandler => {
  const ep = endpoint as unknown as HttpApiEndpoint.AnyWithProps;
  const verb = methodToHandler[ep.method as keyof typeof methodToHandler];
  // `ep.path` already includes the group's `.prefix(...)`, so we can
  // concatenate directly with the base URL.
  const fullPath = `${TEST_API_BASE}${ep.path}`;

  // v4 keeps the request schemas as nullable runtime properties: `params`
  // (path params) and `query` (querystring) are `Schema.Top | undefined`,
  // while `payload` is a content-type-keyed map whose first entry carries
  // the body schema.
  const paramsSchema = ep.params as Schema.Top | undefined;
  const querySchema = ep.query as Schema.Top | undefined;
  const payloadSchema = [...ep.payload.values()][0]?.schemas[0] as Schema.Top | undefined;

  return verb(fullPath, async ({ params, request }) => {
    const url = new URL(request.url);

    const path =
      paramsSchema !== undefined
        ? ((await decodeUnknown(paramsSchema, params)) as ResolverInput<E>["path"])
        : ({} as ResolverInput<E>["path"]);

    const urlParams =
      querySchema !== undefined
        ? ((await decodeUnknown(
            querySchema,
            queryToRecord(url.searchParams),
          )) as ResolverInput<E>["urlParams"])
        : ({} as ResolverInput<E>["urlParams"]);

    const payload =
      payloadSchema !== undefined
        ? ((await decodeUnknown(
            payloadSchema,
            await request.json().catch(() => ({})),
          )) as ResolverInput<E>["payload"])
        : ({} as ResolverInput<E>["payload"]);

    const exit = await Effect.runPromiseExit(resolver({ path, urlParams, payload, request }));

    if (Exit.isSuccess(exit)) {
      // `success`/`error` are now `ReadonlySet<Schema.Top>`; the buffered
      // JSON endpoints in this contract carry exactly one success schema.
      const successSchema = [...ep.success][0] as Schema.Top;
      const status = getStatus(successSchema.ast, 200);
      const encoded = await encodeUnknown(successSchema, exit.value);
      return encoded === undefined
        ? new HttpResponse(null, { status })
        : HttpResponse.json(encoded as JsonValue, { status });
    }

    // Failure path. Surface the failure as the tagged-error JSON the
    // real server would emit. Defects (non-tagged) re-throw so the test
    // sees them as an unmocked exception rather than a 500.
    const failure = Cause.findErrorOption(exit.cause);
    if (Option.isNone(failure)) throw Cause.squash(exit.cause);

    const error = failure.value as { readonly _tag?: string; readonly constructor?: unknown };
    // A `Schema.TaggedError` class IS a `Schema`. The instance's
    // constructor is the variant the resolver failed with — use it
    // directly so the status annotation matches the variant, not the
    // union. Fall back to the first declared error schema if the failure
    // wasn't a tagged class (shouldn't happen for well-typed
    // resolvers; covered for safety).
    const variantSchema =
      typeof error.constructor === "function" && "ast" in (error.constructor as object)
        ? (error.constructor as unknown as Schema.Top)
        : ([...ep.error][0] as Schema.Top);
    const status = getStatus(variantSchema.ast, 500);
    const encoded = await encodeUnknown(variantSchema, error);
    return HttpResponse.json(encoded as JsonValue, { status });
  });
};

// ----- helpers -----

// v4 dropped `HttpApiSchema.getStatus`; the status lives as the
// `httpApiStatus` annotation on the schema AST (mirrors the internal
// `getStatusSuccess`/`getStatusError` helpers).
const resolveStatus = SchemaAST.resolveAt<number>("httpApiStatus");
const getStatus = (ast: SchemaAST.AST, fallback: number): number => resolveStatus(ast) ?? fallback;

const decodeUnknown = (schema: Schema.Top, input: unknown) =>
  Effect.runPromise(
    Schema.decodeUnknownEffect(schema)(input) as Effect.Effect<unknown, unknown, never>,
  );

const encodeUnknown = (schema: Schema.Top, value: unknown) =>
  Effect.runPromise(
    Schema.encodeUnknownEffect(schema)(value) as Effect.Effect<unknown, unknown, never>,
  );

const queryToRecord = (params: URLSearchParams): Record<string, string> => {
  const out: Record<string, string> = {};
  params.forEach((value, key) => {
    out[key] = value;
  });
  return out;
};
