import { Database, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";

import { UsersLookup } from "@/modules/organization/domain/ports/acl/users-lookup.acl.js";
import {
  type FindOrganizationMembershipsQuery,
  type OrganizationMemberView,
} from "@/modules/organization/queries/find-organization-memberships.query.js";
import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { UserId } from "@/platform/ids/user-id.js";

export const findOrganizationMemberships = Effect.fn("findOrganizationMemberships")(function* (
  query: FindOrganizationMembershipsQuery,
) {
  const db = yield* Database.Database;
  const usersLookup = yield* UsersLookup;

  const membershipRows = yield* db
    .makeQuery((execute) =>
      execute((client) =>
        client.any(sql.type(RowSchemas.MembershipRowStd)`
          SELECT * FROM "organization".memberships
          WHERE organization_id = ${query.organizationId}
          ORDER BY created_at ASC
        `),
      ),
    )()
    .pipe(
      Effect.catchTag("DatabaseError", Effect.die),
      Effect.catchTag("DatabaseUnavailable", (e) =>
        Effect.fail(new PersistenceUnavailable({ message: e.message })),
      ),
    );

  const adminRows = yield* db
    .makeQuery((execute) =>
      execute((client) =>
        client.any(sql.type(RowSchemas.OrganizationRoleRowStd)`
          SELECT organization_id, user_id, role, issued_by, created_at
          FROM "organization".organization_roles
          WHERE organization_id = ${query.organizationId} AND role = 'admin'
        `),
      ),
    )()
    .pipe(
      Effect.catchTag("DatabaseError", Effect.die),
      Effect.catchTag("DatabaseUnavailable", (e) =>
        Effect.fail(new PersistenceUnavailable({ message: e.message })),
      ),
    );
  const adminUserIds = new Set(adminRows.map((row) => row.user_id));

  // ADR-0020 forbids cross-schema SQL, so each member's email comes from
  // the user module through the `UsersLookup` ACL rather than a JOIN.
  const users = yield* usersLookup.findByIds(membershipRows.map((m) => UserId.make(m.user_id)));
  const byUserId = new Map(users.map((u) => [u.userId, u]));

  // Preserve membership order (DB-sorted by createdAt). Skip any member
  // the lookup couldn't resolve — a hard inconsistency we don't expect,
  // but better to omit than to crash.
  const toViews = (row: RowSchemas.MembershipRow): ReadonlyArray<OrganizationMemberView> => {
    const user = byUserId.get(UserId.make(row.user_id));
    if (user === undefined) return [];
    return [
      {
        userId: UserId.make(row.user_id),
        email: user.email,
        joinedAt: row.created_at,
        isAdmin: adminUserIds.has(row.user_id),
      },
    ];
  };
  return membershipRows.flatMap(toViews);
});
