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

import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import type { HttpMethod } from "effect/http/HttpMethod";
import type * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import type * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as Record from "effect/Record";
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

// v4 dropped `HttpApiSchema.getStatus`; the status lives as the
// `httpApiStatus` annotation on the schema AST (mirrors the internal
// `getStatusSuccess`/`getStatusError` helpers).
const resolveStatus = SchemaAST.resolveAt<number>("httpApiStatus");

const getStatus = (schema: Schema.Top, fallback: number): number =>
  resolveStatus(schema.ast) ?? fallback;

// SAFETY: an endpoint holds its schemas as `Schema.Top` at runtime; the endpoint's own type
// parameters say what each one decodes to, and a contract schema needs no services.
const contractSchema = <A>(schema: Schema.Top): Schema.Codec<A, JsonBodyType> =>
  // oxlint-disable-next-line effect/noAs -- an HttpApiEndpoint does not expose its schemas' types at runtime
  schema as Schema.Codec<A, JsonBodyType>;

const NO_FIELDS = Schema.Struct({});

/**
 * Absolute base URL handlers register under. Tests use a matching base
 * on the `HttpApiClient` (e.g. `baseUrl: TEST_API_BASE`) so MSW node's
 * interceptor matches the request URL exactly. The real client uses a
 * relative `/api` against the same origin; tests can't be relative
 * because node's `fetch` requires an absolute URL.
 */
export const TEST_API_BASE = "http://localhost/api";

class UnknownEndpoint extends Schema.TaggedError<
  UnknownEndpoint,
  { readonly brand: "UnknownEndpoint" }
>()("UnknownEndpoint", { group: Schema.String, endpoint: Schema.String }) {}

/**
 * `Group.endpoints` is typed as a record of every endpoint in the group —
 * looking up by name yields the union, which loses the concrete
 * payload/path/error types for `typedHandler`. This helper narrows the union
 * by `identifier` so each call site sees only its endpoint's slot types.
 */
export const getEndpoint = <G extends HttpApiGroup.Constraint, Name extends string>(
  group: G,
  name: Name,
): HttpApiEndpoint.Constraint & Extract<HttpApiGroup.Endpoints<G>, { readonly identifier: Name }> =>
  Option.getOrThrowWith(
    Arr.findFirst(
      Object.values(group.endpoints),
      (
        endpoint,
      ): endpoint is HttpApiEndpoint.Constraint &
        Extract<HttpApiGroup.Endpoints<G>, { readonly identifier: Name }> =>
        endpoint.identifier === name,
    ),
    () => new UnknownEndpoint({ group: group.identifier, endpoint: name }),
  );

/** Convert Effect's `HttpMethod` to MSW's `http.verb` accessor. */
const methodToHandler = {
  GET: http.get,
  POST: http.post,
  PUT: http.put,
  PATCH: http.patch,
  DELETE: http.delete,
  HEAD: http.head,
  OPTIONS: http.options,
};

const verbFor = (method: HttpMethod) =>
  Option.getOrElse(Record.get<string, typeof http.all>(methodToHandler, method), () => http.all);

/**
 * Extract the resolver argument from an endpoint. Each schema is
 * conditionally present based on whether the endpoint declares it.
 * `ConstraintRequest` is the minimal interface the extractor types expect.
 */
type ResolverInput<E extends HttpApiEndpoint.ConstraintRequest> = {
  readonly path: HttpApiEndpoint.Params<E>["Type"];
  readonly urlParams: HttpApiEndpoint.Query<E>["Type"];
  readonly payload: HttpApiEndpoint.Payload<E>["Type"];
  readonly request: StrictRequest<DefaultBodyType>;
};

/** Effect the resolver returns: success or any declared tagged error. */
type ResolverEffect<E extends HttpApiEndpoint.ConstraintRequest> = Effect.Effect<
  HttpApiEndpoint.Success<E>["Type"],
  HttpApiEndpoint.Error<E>["Type"]
>;

type Resolver<E extends HttpApiEndpoint.ConstraintRequest> = (
  input: ResolverInput<E>,
) => ResolverEffect<E>;

// The runtime half of an endpoint: what the handler reads to route and encode.
type RoutedEndpoint = Pick<
  HttpApiEndpoint.Top,
  "method" | "path" | "params" | "query" | "payload" | "success" | "error"
>;

const decodeSlot = <A>(schema: Option.Option<Schema.Top>, wire: JsonBodyType) =>
  Schema.decodeEffect(contractSchema<A>(Option.getOrElse(schema, () => NO_FIELDS)))(wire);

const encodeAs = <A>(schema: Schema.Top, value: A) =>
  Schema.encodeEffect(contractSchema<A>(schema))(value);

const readJsonBody = (request: StrictRequest<DefaultBodyType>) =>
  Effect.tryPromise(async (): Promise<JsonBodyType> => request.json()).pipe(
    Effect.orElseSucceed((): JsonBodyType => ({})),
  );

const successResponse = <A>(schema: Schema.Top, value: A) =>
  Effect.map(encodeAs(schema, value), (encoded) => {
    const status = getStatus(schema, 200);

    // oxlint-disable-next-line effect/noNullish -- the Fetch API spells an empty response body null
    if (Predicate.isUndefined(encoded)) return new HttpResponse(null, { status });

    return HttpResponse.json(encoded, { status });
  });

// A `Schema.TaggedError` class IS a `Schema`, and the failure's constructor is
// the variant the resolver failed with -- so the status annotation matches
// the variant, not the union.
const errorResponse = <E>(declared: Schema.Top, error: E) => {
  const variant = Option.some(error).pipe(
    Option.filter(Predicate.isObject),
    Option.map((failure) => failure.constructor),
    Option.filter(Schema.isSchema),
    Option.getOrElse(() => declared),
  );

  return Effect.map(encodeAs(variant, error), (encoded) =>
    HttpResponse.json(encoded, { status: getStatus(variant, 500) }),
  );
};

/**
 * Build an MSW handler for one endpoint. The URL is `TEST_API_BASE` +
 * the endpoint's path (e.g. `/users/:id`). Path/URL params/payload are
 * decoded against the endpoint's schemas; success and errors are
 * encoded with the corresponding schemas plus the status annotations
 * declared via `HttpApiSchema.annotations({ status })`. A defect is not a
 * declared error: it rejects, so the test sees it as an unmocked exception
 * rather than a 500.
 */
export const typedHandler = <E extends HttpApiEndpoint.ConstraintRequest & RoutedEndpoint>(
  endpoint: E,
  resolver: Resolver<E>,
): HttpHandler => {
  // `endpoint.path` already includes the group's `.prefix(...)`.
  const fullPath = `${TEST_API_BASE}${endpoint.path}`;

  // The buffered JSON endpoints in this contract carry one body schema, one
  // success schema and declare their errors in order.
  const payloadSchema = Option.flatMap(Arr.head([...endpoint.payload.values()]), (entry) =>
    Arr.head(entry.schemas),
  );

  const successSchema = Option.getOrElse(Arr.head([...endpoint.success]), () => NO_FIELDS);
  const errorSchema = Option.getOrElse(Arr.head([...endpoint.error]), () => NO_FIELDS);

  const respond = (params: JsonBodyType, request: StrictRequest<DefaultBodyType>) =>
    Effect.gen(function* () {
      const url = new URL(request.url);

      const path = yield* decodeSlot<ResolverInput<E>["path"]>(
        Option.fromUndefinedOr(endpoint.params),
        params,
      );

      const urlParams = yield* decodeSlot<ResolverInput<E>["urlParams"]>(
        Option.fromUndefinedOr(endpoint.query),
        Object.fromEntries(url.searchParams),
      );

      const payload = yield* decodeSlot<ResolverInput<E>["payload"]>(
        payloadSchema,
        yield* readJsonBody(request),
      );

      return yield* resolver({ path, urlParams, payload, request }).pipe(
        Effect.matchEffect({
          onSuccess: (value) => successResponse(successSchema, value),
          onFailure: (error) => errorResponse(errorSchema, error),
        }),
      );
    }).pipe(Effect.orDie);

  return verbFor(endpoint.method)(fullPath, async ({ params, request }) =>
    // oxlint-disable-next-line effect/noEffectRunInTests -- MSW invokes this resolver and awaits its Response; the handler is the Effect's host boundary
    Effect.runPromise(respond(params, request)),
  );
};
