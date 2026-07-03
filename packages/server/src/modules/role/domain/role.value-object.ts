import * as Schema from "effect/Schema";

// Platform-wide role names. The closed set lives here so the
// `roles.root.ts` invariants (and the persistence boundary in
// `role-mapper.ts`) reject any string the rest of the codebase
// doesn't recognize. Adding a new role: extend the literal here.
export const RoleValueObject = Schema.Literal("super_admin");
export type RoleValueObject = typeof RoleValueObject.Type;
