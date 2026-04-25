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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (query: any) => Effect.Effect<unknown, unknown, unknown>;

export const makeQueryBus = (handlers: Record<string, AnyHandler>): QueryBusShape => ({
  execute: ((query: { readonly _tag: string }) => {
    const handler = handlers[query._tag];
    if (handler === undefined) {
      return Effect.die(new Error(`[QueryBus] no handler registered for '${query._tag}'`));
    }
    return handler(query);
  }) as QueryBusShape["execute"],
});
