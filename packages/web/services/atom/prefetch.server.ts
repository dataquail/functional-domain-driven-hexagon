// Server-side prefetch. Runs a query's Effect on the per-request runtime and
// encodes the result into the entry a browser registry preloads.
//
// Note what is absent: no JSON round-trip. `dehydrateQuery` encodes through the
// endpoint's own schema, so what crosses the RSC boundary is already plain
// JSON -- the `Schema.Class` instances that Next refuses to serialize never
// reach it.
//
// A failed prefetch yields no entry rather than throwing. The page still
// renders; the client atom simply fetches for itself and any failure surfaces
// at the nearest error boundary, which is where a request failure belongs.
import "server-only";

import type * as Effect from "effect/Effect";
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type * as Atom from "effect/unstable/reactivity/Atom";
import type * as Hydration from "effect/unstable/reactivity/Hydration";

import type { ApiClient } from "@/services/api-client.shared";
import { getServerRuntime } from "@/services/runtime.server";

import { dehydrateQuery } from "./dehydration.shared";

export const prefetchQuery = async <A, E>(
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
  effect: Effect.Effect<A, E, ApiClient>,
): Promise<Hydration.DehydratedAtom | null> => {
  const runtime = await getServerRuntime();
  const exit = await runtime.runPromiseExit(effect);
  return exit._tag === "Success" ? dehydrateQuery(atom, exit.value) : null;
};

export const collectPrefetched = async (
  prefetches: ReadonlyArray<Promise<Hydration.DehydratedAtom | null>>,
): Promise<ReadonlyArray<Hydration.DehydratedAtom>> => {
  const settled = await Promise.all(prefetches);
  return settled.filter((entry): entry is Hydration.DehydratedAtom => entry !== null);
};
