import * as Context from "effect/Context";
import * as Layer from "effect/Layer";

import type { Exported, ExportsDeclaration, Listed, Module } from "./module.js";

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

// The guards sit in an intersection with the parameter whose layer types they
// read, never in a conditional occupying that parameter alone: TypeScript does
// not infer through a conditional type, so the latter shape resolves `RIn` at
// its constraint and the check silently passes.
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
//   Listed    the subset declared as a list, which `"all"` opts out of
//   Consumed  what the modules actually took out of `Visible`
//   Assembled everything built, which is what `build().layer` publishes
//
// `.add` tests requirements against `Visible`; `build` refuses a `Listed` entry
// that no module consumed, so an exports declaration stays exactly tight rather
// than drifting into a ceiling.
export type Builder<
  Platform,
  Names extends ReadonlyArray<string>,
  Visible,
  ListedExports,
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
    Exports extends ExportsDeclaration,
    H extends Layer.Any,
    D extends Layer.Any,
  >(
    module: Module<Name, Layer.Layer<ROut, E2, RIn>, Exports, H, D> &
      Guard<Name, Names, Assembled, Exclude<RIn, Platform | Visible>>,
  ) => Builder<
    Platform,
    readonly [...Names, Name],
    Visible | Exported<Layer.Layer<ROut, E2, RIn>, Exports>,
    ListedExports | Listed<Layer.Layer<ROut, E2, RIn>, Exports>,
    Consumed | Extract<RIn, Visible>,
    Assembled | ROut,
    E | E2,
    Merged<Http, H>,
    Merged<HttpDeps, D>
  >;
  // Reported here rather than at `.add` because no module is known to be the
  // last consumer until every module has been added.
  readonly build: () => [Exclude<ListedExports, Consumed>] extends [never]
    ? App<Platform, Names, Assembled, E, Http, HttpDeps>
    : UnusedExports<Exclude<ListedExports, Consumed>>;
};

type ErasedLayer = Layer.Layer<never, never, never>;

type ErasedModule = {
  readonly name: string;
  readonly layer: ErasedLayer;
  readonly exports: ExportsDeclaration;
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

// The type-level fence, enforced at runtime too: what a later module is handed
// is a context with the unexported keys actually removed, not merely a narrower
// claim about the same one.
const narrow = (layer: ErasedLayer, exports: ExportsDeclaration): ErasedLayer =>
  exports === "all"
    ? layer
    : Layer.flatMap(layer, (context) => Layer.succeedContext(Context.pick(...exports)(context)));

const erasedBuilder = (added: ReadonlyArray<ErasedModule>): ErasedBuilder => ({
  add: (module) => erasedBuilder([...added, module]),
  build: () => {
    // Each module is built against the exports of the modules added before it
    // and nothing else. Both accumulations reference the same resolved layer, so
    // the memo map builds each module once however many times it is named.
    let visible: ErasedLayer = Layer.empty;
    let assembled: ErasedLayer = Layer.empty;
    for (const module of added) {
      const resolved = Layer.provide(module.layer, visible);
      assembled = Layer.merge(assembled, resolved);
      visible = Layer.merge(visible, narrow(resolved, module.exports));
    }
    return {
      names: added.map((module) => module.name),
      layer: assembled,
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
