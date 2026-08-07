import * as Context from "effect/Context";
import * as Effect from "effect/Effect";

import { type DispatchTable, MissingHandler } from "./dispatch-table.js";
import { assertEveryTagRoutable } from "./internal/completeness.js";
import type * as Query from "./query.js";

/**
 * The application-wide read-side bus. Semantics mirror `CommandBus`; the split into two
 * is what preserves the CQRS distinction at the type level, since `Query.Any` carries
 * the read side and so a command definition is rejected here.
 *
 * One asymmetry worth stating: a query resolved inside a caller's transaction reads
 * through that transaction, because handlers run in the dispatching fiber. An
 * authorization check resolved during a mutation therefore sees that mutation's
 * uncommitted writes rather than a stale view.
 */
export type QueryBusShape = {
  readonly execute: <M extends Query.Any>(
    query: M,
    payload: Query.Payload<M>,
  ) => Effect.Effect<Query.Success<M>, Query.Failure<M>, never>;
  /** Every tag this bus routes — see `CommandBusShape.tags`. */
  readonly tags: ReadonlySet<string>;
};

export class QueryBus extends Context.Service<QueryBus, QueryBusShape>()("@org/cqrs/QueryBus") {}

/** See `makeCommandBus` — same routing, same reason it belongs at a composition root. */
export const makeQueryBus = (
  dispatch: DispatchTable,
  options: { readonly declaredIn?: ReadonlyArray<Query.AnyGroup> } = {},
): QueryBusShape => {
  const tags = new Set(Object.keys(dispatch));
  assertEveryTagRoutable("QueryBus", tags, options.declaredIn);

  return {
    execute: ((query: { readonly tag: string }, payload: never) => {
      const dispatcher = dispatch[query.tag];
      if (dispatcher === undefined) {
        return Effect.die(new MissingHandler({ bus: "QueryBus", tag: query.tag }));
      }
      return dispatcher(payload);
    }) as QueryBusShape["execute"],
    tags,
  };
};
