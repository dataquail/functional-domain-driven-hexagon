import {
  type SpanAttributeValue,
  type SpanAttributesExtractor,
} from "@/platform/span-attributable.js";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";

// Each query registers an entry here via TypeScript declaration merging.
// See `command-bus.ts` for the equivalent pattern — semantics are identical,
// but the split into two buses preserves the CQRS distinction at the type
// level (a CommandBus.execute will not accept a query, and vice versa).
// Intentionally empty — modules extend this via TypeScript declaration merging.
/* eslint-disable @typescript-eslint/no-empty-interface, @typescript-eslint/no-empty-object-type */
export interface QueryRegistry {}
/* eslint-enable @typescript-eslint/no-empty-interface, @typescript-eslint/no-empty-object-type */

type RegisteredQuery = QueryRegistry[keyof QueryRegistry] extends {
  readonly query: infer Q;
}
  ? Q
  : never;

export interface QueryBusShape {
  readonly execute: <Q extends RegisteredQuery>(
    query: Q,
  ) => Q extends { readonly _tag: infer T extends keyof QueryRegistry }
    ? QueryRegistry[T] extends { readonly output: infer O }
      ? O
      : never
    : never;
}

export class QueryBus extends Context.Tag("QueryBus")<QueryBus, QueryBusShape>() {}

type QueryFor<T extends keyof QueryRegistry> = QueryRegistry[T] extends {
  readonly query: infer Q;
}
  ? Q
  : never;

type OutputFor<T extends keyof QueryRegistry> = QueryRegistry[T] extends {
  readonly output: infer O;
}
  ? O
  : never;

export type QueryHandlerEntry<T extends keyof QueryRegistry> = {
  readonly handle: (query: QueryFor<T>) => OutputFor<T>;
  readonly spanAttributes?: SpanAttributesExtractor<QueryFor<T>>;
};

export type QueryHandlers<K extends keyof QueryRegistry = keyof QueryRegistry> = {
  readonly [T in K]: QueryHandlerEntry<T>;
};

export const queryHandlers = <
  const M extends {
    readonly [K in keyof M]: K extends keyof QueryRegistry ? QueryHandlerEntry<K> : never;
  },
>(
  map: M,
): M => map;

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
