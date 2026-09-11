import * as Layer from "effect/Layer";

import type { Module } from "./module.js";

export type MissingDependencies<Name extends string, Missing> = {
  readonly _MissingDependencies: {
    readonly module: Name;
    readonly missing: Missing;
  };
};

export type NotExported<Name extends string, Hidden> = {
  readonly _NotExported: {
    readonly module: Name;
    readonly hidden: Hidden;
  };
};

export type DuplicateModule<Name extends string> = {
  readonly _DuplicateModule: Name;
};

export type UnusedExports<Unused> = {
  readonly _UnusedExports: Unused;
};

// The guards sit in an intersection with the parameter whose types they read,
// never in a conditional occupying that parameter alone: TypeScript does not
// infer through a conditional type, so the latter shape resolves `RIn` at its
// constraint and the check silently passes.
//
// A requirement an earlier module builds but does not export is reported apart
// from one nothing builds at all: they are different mistakes, and only the
// second is fixed by adding a module.
type Guard<Name extends string, Names extends ReadonlyArray<string>, Assembled, Missing> = ([
  Exclude<Missing, Assembled>,
] extends [never]
  ? unknown
  : MissingDependencies<Name, Exclude<Missing, Assembled>>) &
  ([Extract<Missing, Assembled>] extends [never]
    ? unknown
    : NotExported<Name, Extract<Missing, Assembled>>) &
  (Name extends Names[number] ? DuplicateModule<Name> : unknown);

type Merged<A extends Layer.Any, B extends Layer.Any> = Layer.Layer<
  Layer.Success<A> | Layer.Success<B>,
  Layer.Error<A> | Layer.Error<B>,
  Layer.Services<A> | Layer.Services<B>
>;

export type App<
  Platform,
  Names extends ReadonlyArray<string>,
  Assembled,
  E,
  Http extends Layer.Any,
  HttpDeps extends Layer.Any,
> = {
  readonly names: Names;
  readonly layer: Layer.Layer<Assembled, E, Platform>;
  readonly http: Http;
  readonly httpDeps: HttpDeps;
};

// Four accumulations, because the composition root is a privileged consumer, a
// peer module is not, and an export nobody takes is debt rather than safety.
//
//   Visible   what a later module may resolve — every earlier export
//   Exported  every export declared, which `build` holds to having a consumer
//   Consumed  what the modules actually took out of `Visible`
//   Assembled everything built, which is what `build().layer` publishes
//
// The fence is type-level. What a module publishes is often a registration
// token, which has no runtime identity to filter a context by — the value behind
// it belongs to the transport. `Assembled` therefore carries everything at
// runtime and `Visible` is what the type checker holds a peer to.
export type Builder<
  Platform,
  Names extends ReadonlyArray<string>,
  Visible,
  Exported,
  Consumed,
  Assembled,
  E,
  Http extends Layer.Any,
  HttpDeps extends Layer.Any,
> = {
  readonly add: <
    Name extends string,
    ROut,
    E2,
    RIn,
    ModuleExports,
    H extends Layer.Any,
    D extends Layer.Any,
  >(
    module: Module<Name, Layer.Layer<ROut, E2, RIn>, ModuleExports, H, D> &
      Guard<Name, Names, Assembled, Exclude<RIn, Platform | Visible>>,
  ) => Builder<
    Platform,
    readonly [...Names, Name],
    Visible | ModuleExports,
    Exported | ModuleExports,
    Consumed | Extract<RIn, Visible>,
    Assembled | ROut,
    E | E2,
    Merged<Http, H>,
    Merged<HttpDeps, D>
  >;
  // Reported here rather than at `.add` because no module is known to be the
  // last consumer until every module has been added.
  readonly build: () => [Exclude<Exported, Consumed>] extends [never]
    ? App<Platform, Names, Assembled, E, Http, HttpDeps>
    : UnusedExports<Exclude<Exported, Consumed>>;
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
  build: () => {
    // Each module is built against the modules added before it, and the type
    // checker is what holds it to the subset they exported.
    const layer = added.reduce<ErasedLayer>(
      (accumulated, module) => Layer.provideMerge(module.layer, accumulated),
      Layer.empty,
    );
    return {
      names: added.map((module) => module.name),
      layer,
      http: Layer.mergeAll(Layer.empty, ...added.map((module) => module.http)),
      httpDeps: Layer.mergeAll(Layer.empty, ...added.map((module) => module.httpDeps)),
    };
  },
});

export const app = <Platform>(): Builder<
  Platform,
  readonly [],
  never,
  never,
  never,
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
    never,
    never,
    never,
    Layer.Layer<never>,
    Layer.Layer<never>
  >;
