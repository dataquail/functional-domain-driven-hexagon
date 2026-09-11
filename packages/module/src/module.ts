import * as Layer from "effect/Layer";

// A module's three layers are provided at three different points in an
// application's assembly, and the point is not interchangeable: `httpDeps`
// attached anywhere but the assembled `HttpApiBuilder.layer` type-checks and
// then fails at runtime with `Service not found`.
export type Module<
  Name extends string,
  Services extends Layer.Any,
  Exports,
  Http extends Layer.Any,
  HttpDeps extends Layer.Any,
> = {
  readonly name: Name;
  readonly layer: Services;
  readonly http: Http;
  readonly httpDeps: HttpDeps;
  // Phantom. What a module publishes is a set of services, and the ones that
  // matter here have no runtime identity to carry — a registration token is a
  // type over a handler context the transport owns. So the declaration is a type
  // argument, and the builder checks it without anything to hold at runtime.
  readonly exports: (_: never) => Exports;
};

export type Any = Module<string, Layer.Any, unknown, Layer.Any, Layer.Any>;

/**
 * Declares a module. The type argument is what peers may resolve from it, and it
 * defaults to nothing — a module publishes on purpose or not at all.
 */
export const make =
  <Exports = never>() =>
  <
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
    Exports,
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
      Exports,
      Layer.Layer<HttpROut, HttpE, HttpRIn>,
      Layer.Layer<HttpDepsROut, HttpDepsE, HttpDepsRIn>
    >;
