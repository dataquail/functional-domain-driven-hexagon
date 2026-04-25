import * as Schema from "effect/Schema";

export const UserId = Schema.String.pipe(Schema.brand("UserId"));
export type UserId = typeof UserId.Type;

export const TodoId = Schema.String.pipe(Schema.brand("TodoId"));
export type TodoId = typeof TodoId.Type;
