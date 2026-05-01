import * as Schema from "effect/Schema";

export const SessionId = Schema.UUID.pipe(Schema.brand("SessionId"));
export type SessionId = typeof SessionId.Type;
