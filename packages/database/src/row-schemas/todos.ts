import type { StandardSchemaV1 } from "@standard-schema/spec";
import * as Schema from "effect/Schema";

export const TodoRow = Schema.Struct({
  id: Schema.UUID,
  title: Schema.String,
  completed: Schema.Boolean,
  created_at: Schema.DateFromSelf,
  updated_at: Schema.DateFromSelf,
});
export type TodoRow = typeof TodoRow.Type;

export const TodoRowStd: StandardSchemaV1<unknown, TodoRow> = Schema.standardSchemaV1(TodoRow);
