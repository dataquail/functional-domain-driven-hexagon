import * as Schema from "effect/Schema";

export const UserRole = Schema.Literal("admin", "moderator", "guest");
export type UserRole = typeof UserRole.Type;
