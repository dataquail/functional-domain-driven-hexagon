import { type Database } from "@org/database/index";
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type TodoId } from "@/modules/todos/domain/todo-id.js";
import { type PersistenceUnavailable } from "@/platform/ddd/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/span-attributable.js";

export const ListTodosQuery = Schema.TaggedStruct("ListTodosQuery", {});
export type ListTodosQuery = typeof ListTodosQuery.Type;

export const listTodosQuerySpanAttributes: SpanAttributesExtractor<ListTodosQuery> = () => ({});

export type ListTodosTodoView = {
  readonly id: TodoId;
  readonly title: string;
  readonly completed: boolean;
};

export type ListTodosResult = {
  readonly todos: ReadonlyArray<ListTodosTodoView>;
};

export type ListTodosOutput = Effect.Effect<
  ListTodosResult,
  PersistenceUnavailable,
  Database.Database
>;

declare module "@/platform/ddd/query-bus.js" {
  interface QueryRegistry {
    ListTodosQuery: {
      readonly query: ListTodosQuery;
      readonly output: ListTodosOutput;
    };
  }
}
