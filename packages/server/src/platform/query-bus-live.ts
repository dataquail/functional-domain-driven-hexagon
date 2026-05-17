import {
  type QueryBusShape,
  type QueryHandlerEntry,
  type QueryHandlers,
  type QueryRegistry,
} from "@/platform/ddd/query-bus.js";
import { type SpanAttributeValue } from "@/platform/ddd/span-attributable.js";
import * as Effect from "effect/Effect";

export const makeQueryBus = (handlers: QueryHandlers): QueryBusShape => ({
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
