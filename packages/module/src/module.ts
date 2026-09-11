import type * as Context from "effect/Context";
import * as Layer from "effect/Layer";

// What a module publishes to the modules added after it. `"all"` is the named
// escape hatch; a list is the tight case, and omitting it exports nothing.
export type ExportsDeclaration = "all" | ReadonlyArray<Context.Service.Any>;

// A module's three layers are provided at three different points in an
// application's assembly, and the point is not interchangeable: `httpDeps`
// attached anywhere but the assembled `HttpApiBuilder.layer` type-checks and
// then fails at runtime with `Service not found`.
export type Module<
  Name extends string,
  Services extends Layer.Any,
  Exports extends ExportsDeclaration,
  Http extends Layer.Any,
  HttpDeps extends Layer.Any,
> = {
  readonly name: Name;
  readonly layer: Services;
  readonly exports: Exports;
  readonly http: Http;
  readonly httpDeps: HttpDeps;
};

export type Any = Module<string, Layer.Any, ExportsDeclaration, Layer.Any, Layer.Any>;

// The services an exports declaration resolves to. A module that declares none
// resolves to `never`, which is what makes the default a closed module rather
// than an open one.
export type Exported<
  Services extends Layer.Any,
  Exports extends ExportsDeclaration,
> = Exports extends "all"
  ? Layer.Success<Services>
  : Exports extends ReadonlyArray<Context.Service.Any>
    ? Context.Service.Identifier<Exports[number]>
    : never;

// Declares an exports list. A bare array literal would infer `any[]` when empty,
// and `Context.Service.Identifier<any>` is `any` — which would silently widen the
// builder's visibility to everything. This cannot.
// What an explicit exports list contributes to the unused-export check. `"all"`
// is the named escape hatch, so it contributes nothing: an escape hatch opts out
// of the ratchet rather than failing it.
export type Listed<
  Services extends Layer.Any,
  Exports extends ExportsDeclaration,
> = Exports extends "all" ? never : Exported<Services, Exports>;

export const exports = <const Tags extends ReadonlyArray<Context.Service.Any>>(
  ...tags: Tags
): Tags => tags;

export const make = <
  Name extends string,
  ROut,
  E,
  RIn,
  const Exports extends ExportsDeclaration = readonly [],
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
    readonly exports?: Exports;
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
    exports: options?.exports ?? [],
    http: options?.http ?? Layer.empty,
    httpDeps: options?.httpDeps ?? Layer.empty,
  }) as Module<
    Name,
    Layer.Layer<ROut, E, RIn>,
    Exports,
    Layer.Layer<HttpROut, HttpE, HttpRIn>,
    Layer.Layer<HttpDepsROut, HttpDepsE, HttpDepsRIn>
  >;
