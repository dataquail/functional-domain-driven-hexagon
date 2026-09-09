import * as Layer from "effect/Layer";

import type { Module } from "./module.js";

export type MissingDependencies<Name extends string, Missing> = {
  readonly _MissingDependencies: {
    readonly module: Name;
    readonly missing: Missing;
  };
};

export type DuplicateModule<Name extends string> = {
  readonly _DuplicateModule: Name;
};

// The guards sit in an intersection with the parameter whose layer types they
// read, never in a conditional occupying that parameter alone: TypeScript does
// not infer through a conditional type, so the latter shape resolves `RIn` at
// its constraint and the check silently passes.
type Guard<Name extends string, Names extends ReadonlyArray<string>, Missing> = ([Missing] extends [
  never,
]
  ? unknown
  : MissingDependencies<Name, Missing>) &
  (Name extends Names[number] ? DuplicateModule<Name> : unknown);

type Merged<A extends Layer.Any, B extends Layer.Any> = Layer.Layer<
  Layer.Success<A> | Layer.Success<B>,
  Layer.Error<A> | Layer.Error<B>,
  Layer.Services<A> | Layer.Services<B>
>;

export type App<
  Platform,
  Names extends ReadonlyArray<string>,
  Provided,
  E,
  Http extends Layer.Any,
  HttpDeps extends Layer.Any,
> = {
  readonly names: Names;
  readonly layer: Layer.Layer<Provided, E, Platform>;
  readonly http: Http;
  readonly httpDeps: HttpDeps;
};

export type Builder<
  Platform,
  Names extends ReadonlyArray<string>,
  Provided,
  E,
  Http extends Layer.Any,
  HttpDeps extends Layer.Any,
> = {
  readonly add: <Name extends string, ROut, E2, RIn, H extends Layer.Any, D extends Layer.Any>(
    module: Module<Name, Layer.Layer<ROut, E2, RIn>, H, D> &
      Guard<Name, Names, Exclude<RIn, Platform | Provided>>,
  ) => Builder<
    Platform,
    readonly [...Names, Name],
    Provided | ROut,
    E | E2,
    Merged<Http, H>,
    Merged<HttpDeps, D>
  >;
  readonly build: () => App<Platform, Names, Provided, E, Http, HttpDeps>;
};

type ErasedLayer = Layer.Layer<never, never, never>;

type ErasedModule = {
  readonly name: string;
  readonly layer: ErasedLayer;
  readonly http: ErasedLayer;
  readonly httpDeps: ErasedLayer;
};

type ErasedBuilder = {
  readonly add: (module: ErasedModule) => ErasedBuilder;
  readonly build: () => {
    readonly names: ReadonlyArray<string>;
    readonly layer: ErasedLayer;
    readonly http: ErasedLayer;
    readonly httpDeps: ErasedLayer;
  };
};

const erasedBuilder = (added: ReadonlyArray<ErasedModule>): ErasedBuilder => ({
  add: (module) => erasedBuilder([...added, module]),
  build: () => ({
    names: added.map((module) => module.name),
    // Each module is provided the accumulation of the modules added before it
    // and merged into it, so it reaches those and nothing else; what stays open
    // is the platform.
    layer: added.reduce<ErasedLayer>(
      (accumulated, module) => Layer.provideMerge(module.layer, accumulated),
      Layer.empty,
    ),
    http: Layer.mergeAll(Layer.empty, ...added.map((module) => module.http)),
    httpDeps: Layer.mergeAll(Layer.empty, ...added.map((module) => module.httpDeps)),
  }),
});

export const app = <Platform>(): Builder<
  Platform,
  readonly [],
  never,
  never,
  Layer.Layer<never>,
  Layer.Layer<never>
> =>
  erasedBuilder([]) as unknown as Builder<
    Platform,
    readonly [],
    never,
    never,
    Layer.Layer<never>,
    Layer.Layer<never>
  >;
