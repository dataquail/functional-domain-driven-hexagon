import { type Database } from "@org/database/index";
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type TodoId } from "@/modules/todos/domain/todo.id.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

export const ListTodosQuery = Schema.TaggedStruct("ListTodosQuery", {
  organizationId: OrganizationId,
});
export type ListTodosQuery = typeof ListTodosQuery.Type;

export const listTodosQuerySpanAttributes: SpanAttributesExtractor<ListTodosQuery> = (query) => ({
  "organization.id": query.organizationId,
});

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

declare module "@/platform/ddd/ports/query-bus.js" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- declaration merging requires `interface`
  interface QueryRegistry {
    ListTodosQuery: {
      readonly query: ListTodosQuery;
      readonly output: ListTodosOutput;
    };
  }
}
