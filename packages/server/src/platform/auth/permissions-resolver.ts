import { type UserId } from "@/platform/ids/user-id.js";
import { type Permission } from "@org/contracts/Policy";
import { Database, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

// Slice-scope: read users.role and map role → permissions via a static map.
// Everything currently flows through the existing __test:* permission set —
// when real domain permissions are introduced, expand the map below.

const adminPermissions: ReadonlySet<Permission> = new Set([
  "__test:read",
  "__test:manage",
  "__test:delete",
] satisfies Array<Permission>);

const moderatorPermissions: ReadonlySet<Permission> = new Set([
  "__test:read",
  "__test:manage",
] satisfies Array<Permission>);

const guestPermissions: ReadonlySet<Permission> = new Set([
  "__test:read",
] satisfies Array<Permission>);

const forRole = (role: string): ReadonlySet<Permission> => {
  switch (role) {
    case "admin":
      return adminPermissions;
    case "moderator":
      return moderatorPermissions;
    default:
      return guestPermissions;
  }
};

export class PermissionsResolver extends Effect.Service<PermissionsResolver>()(
  "PermissionsResolver",
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const db = yield* Database.Database;
      const RoleRow = Schema.Struct({ role: Schema.String });
      const RoleRowStd = Schema.standardSchemaV1(RoleRow);
      const get = db.makeQuery((execute, userId: UserId) =>
        execute((client) =>
          client.maybeOne(sql.type(RoleRowStd)`
            SELECT role FROM users WHERE id = ${userId}
          `),
        ).pipe(
          Effect.map((row) => (row === null ? guestPermissions : forRole(row.role))),
          Effect.catchTag("DatabaseError", Effect.die),
          Effect.withSpan("PermissionsResolver.get"),
        ),
      );
      return { get } as const;
    }),
  },
) {}
