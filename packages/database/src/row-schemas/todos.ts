import * as Schema from "effect/Schema";

export const TodoRow = Schema.Struct({
  id: Schema.String.check(Schema.isGUID()),
  organization_id: Schema.String.check(Schema.isGUID()),
  title: Schema.String,
  completed: Schema.Boolean,
  created_at: Schema.DateTimeUtcFromDate,
  updated_at: Schema.DateTimeUtcFromDate,
});
export type TodoRow = typeof TodoRow.Type;
