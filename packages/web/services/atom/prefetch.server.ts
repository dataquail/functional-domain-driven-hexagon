// Server-side prefetch. Runs a query's Effect on the per-request runtime and
// encodes the result into the entry a browser registry preloads.
//
// Note what is absent: no JSON round-trip. `dehydrateQuery` encodes through the
// endpoint's own schema, so what crosses to the browser is already plain
// JSON -- the `Schema.Class` instances a load function cannot serialize never
// reach it.
//
// A failed fetch yields no entry rather than failing the load. The page still
// renders; the client atom simply fetches for itself and any failure surfaces
// at the nearest error boundary, which is where a request failure belongs.
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type * as Hydration from "effect/reactivity/Hydration";

import type { ApiClient } from "@/services/api-client.shared";
import { getServerRuntime } from "@/services/runtime.server";

import { dehydrateQuery } from "./dehydration.shared";

export type Prefetch = Effect.Effect<Option.Option<Hydration.DehydratedAtom>, never, ApiClient>;

const PREFETCH_CONCURRENCY = 4;

export const prefetchQuery = <A, E>(
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
  effect: Effect.Effect<A, E, ApiClient>,
): Prefetch =>
  Effect.flatMap(Effect.exit(effect), (exit) =>
    Option.match(Exit.getSuccess(exit), {
      onNone: () => Effect.succeedNone,
      onSome: (value) => Effect.asSome(Effect.orDie(dehydrateQuery(atom, value))),
    }),
  );

export const collectPrefetched = async (
  prefetches: ReadonlyArray<Prefetch>,
): Promise<ReadonlyArray<Hydration.DehydratedAtom>> => {
  const runtime = await getServerRuntime();

  const entries = await runtime.runPromise(
    Effect.all(prefetches, { concurrency: PREFETCH_CONCURRENCY }),
  );

  return Arr.getSomes(entries);
};
