import { type Permission } from "@org/contracts/Policy";
import { Database, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type UserId } from "@/platform/ids/user-id.js";

import { translatePersistenceUnavailable } from "../translate-persistence-unavailable.js";

// Slice-scope: read users.is_super_admin and map to permissions via a
// static map. Everything currently flows through the existing __test:*
// permission set — when real domain permissions are introduced, expand the
// map below. Per ADR-0021 plan: ACL will replace this entirely in Phase 4.

const superAdminPermissions: ReadonlySet<Permission> = new Set([
  "__test:read",
  "__test:manage",
  "__test:delete",
] satisfies Array<Permission>);

const memberPermissions: ReadonlySet<Permission> = new Set([
  "__test:read",
] satisfies Array<Permission>);

const forFlag = (isSuperAdmin: boolean): ReadonlySet<Permission> =>
  isSuperAdmin ? superAdminPermissions : memberPermissions;

export class PermissionsResolver extends Effect.Service<PermissionsResolver>()(
  "PermissionsResolver",
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const db = yield* Database.Database;
      const FlagRow = Schema.Struct({ is_super_admin: Schema.Boolean });
      const FlagRowStd = Schema.standardSchemaV1(FlagRow);
      const get = db.makeQuery((execute, userId: UserId) =>
        execute((client) =>
          client.maybeOne(sql.type(FlagRowStd)`
            SELECT is_super_admin FROM "user".users WHERE id = ${userId}
          `),
        ).pipe(
          Effect.map((row) => (row === null ? memberPermissions : forFlag(row.is_super_admin))),
          Effect.catchTag("DatabaseError", Effect.die),
          translatePersistenceUnavailable,
          Effect.withSpan("PermissionsResolver.get"),
        ),
      );
      return { get } as const;
    }),
  },
) {}
