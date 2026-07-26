import * as Effect from "effect/Effect";

import { type SpanAttributeValue } from "@/platform/ddd/contracts/span-attributable.js";
import {
  type QueryBusShape,
  type QueryHandlerEntry,
  type QueryHandlers,
  type QueryRegistry,
} from "@/platform/ddd/ports/query-bus.js";

// Accepts a subset of the registry so an integration test can stage just the
// handlers its sub-graph needs (ADR-0009). An unregistered tag already dies with
// a clear message at dispatch, so a partial map is a runtime-safe narrowing, not
// a hole — the composition roots still pass every handler.
export const makeQueryBus = <K extends keyof QueryRegistry>(
  handlers: QueryHandlers<K>,
): QueryBusShape => ({
  execute: ((query: { readonly _tag: string }) => {
    const entry = (handlers as Record<string, QueryHandlerEntry<keyof QueryRegistry>>)[query._tag];
    if (entry === undefined) {
      return Effect.die(new Error(`[QueryBus] no handler registered for '${query._tag}'`));
    }
    const extra: Record<string, SpanAttributeValue> =
      entry.spanAttributes !== undefined ? entry.spanAttributes(query as never) : {};
    return (entry.handle(query as never) as Effect.Effect<unknown, unknown, unknown>).pipe(
      Effect.withSpan(`query:${query._tag}`, {
        attributes: { "query.tag": query._tag, ...extra },
      }),
    );
  }) as QueryBusShape["execute"],
});
