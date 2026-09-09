import * as Layer from "effect/Layer";

// A module's three layers are provided at three different points in an
// application's assembly, and the point is not interchangeable: `httpDeps`
// attached anywhere but the assembled `HttpApiBuilder.layer` type-checks and
// then fails at runtime with `Service not found`.
export type Module<
  Name extends string,
  Services extends Layer.Any,
  Http extends Layer.Any,
  HttpDeps extends Layer.Any,
> = {
  readonly name: Name;
  readonly layer: Services;
  readonly http: Http;
  readonly httpDeps: HttpDeps;
};

export type Any = Module<string, Layer.Any, Layer.Any, Layer.Any>;

export const make = <
  Name extends string,
  ROut,
  E,
  RIn,
  HttpROut = never,
  HttpE = never,
  HttpRIn = never,
  HttpDepsROut = never,
  HttpDepsE = never,
  HttpDepsRIn = never,
>(
  name: Name,
  layer: Layer.Layer<ROut, E, RIn>,
  options?: {
    readonly http?: Layer.Layer<HttpROut, HttpE, HttpRIn>;
    readonly httpDeps?: Layer.Layer<HttpDepsROut, HttpDepsE, HttpDepsRIn>;
  },
): Module<
  Name,
  Layer.Layer<ROut, E, RIn>,
  Layer.Layer<HttpROut, HttpE, HttpRIn>,
  Layer.Layer<HttpDepsROut, HttpDepsE, HttpDepsRIn>
> =>
  ({
    name,
    layer,
    http: options?.http ?? Layer.empty,
    httpDeps: options?.httpDeps ?? Layer.empty,
  }) as Module<
    Name,
    Layer.Layer<ROut, E, RIn>,
    Layer.Layer<HttpROut, HttpE, HttpRIn>,
    Layer.Layer<HttpDepsROut, HttpDepsE, HttpDepsRIn>
  >;
