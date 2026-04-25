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

export type QueryHandlerFor<T extends keyof QueryRegistry> = (
  query: QueryRegistry[T] extends { readonly query: infer Q } ? Q : never,
) => QueryRegistry[T] extends { readonly output: infer O } ? O : never;

export type QueryHandlers<K extends keyof QueryRegistry = keyof QueryRegistry> = {
  readonly [T in K]: QueryHandlerFor<T>;
};

export const queryHandlers = <
  const M extends {
    readonly [K in keyof M]: K extends keyof QueryRegistry ? QueryHandlerFor<K> : never;
  },
>(
  map: M,
): M => map;

export const makeQueryBus = (handlers: QueryHandlers): QueryBusShape => ({
  execute: ((query: { readonly _tag: string }) => {
    const handler = (handlers as Record<string, QueryHandlerFor<keyof QueryRegistry>>)[query._tag];
    if (handler === undefined) {
      return Effect.die(new Error(`[QueryBus] no handler registered for '${query._tag}'`));
    }
    return handler(query as never);
  }) as QueryBusShape["execute"],
});
