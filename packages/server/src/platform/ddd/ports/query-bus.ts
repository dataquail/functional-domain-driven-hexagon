import * as Context from "effect/Context";

import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";

// Port for the read-side bus. See `command-bus.ts` for the equivalent
// pattern — semantics are identical, but the split into two buses
// preserves the CQRS distinction at the type level (a CommandBus.execute
// will not accept a query, and vice versa). The live implementation
// (`makeQueryBus` in `platform/query-bus-live.ts`) is wired only at the
// composition root.
// Intentionally empty — modules extend this via TypeScript declaration merging.
// It must stay an `interface` (declaration merging does not work on `type`); the
// lint rules that would fight the empty interface and rewrite it to `type` are
// disabled for the registry seam files in eslint.config.mjs.
export interface QueryRegistry {}

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
