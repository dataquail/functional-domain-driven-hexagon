import { Database, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type FindMembershipQuery } from "@/modules/organization/queries/find-membership.query.js";
import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";

const CountRowStd = Schema.toStandardSchemaV1(Schema.Struct({ value: Schema.Number }));

// `makeQuery` (not bare `execute`) so the read joins the ambient
// transaction when one exists — this query is dispatched by
// `MembershipService` during a command's authorization, inside its unit
// of work.
export const findMembership = Effect.fn("findMembership")(function* (query: FindMembershipQuery) {
  const db = yield* Database.Database;
  const readCount = db.makeQuery((execute) =>
    execute((client) =>
      client.one(sql.type(CountRowStd)`
          SELECT COUNT(*)::int AS value FROM "organization".memberships
          WHERE user_id = ${query.userId} AND organization_id = ${query.organizationId}
        `),
    ),
  );
  const row = yield* readCount().pipe(
    Effect.catchTag("DatabaseError", Effect.die),
    Effect.catchTag("DatabaseUnavailable", (e) =>
      Effect.fail(new PersistenceUnavailable({ message: e.message })),
    ),
  );
  return { isMember: row.value > 0 };
});
