import { Database, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type FindMembershipPayload } from "@/modules/organization/queries/find-membership.policy-query.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

const CountRowStd = Schema.toStandardSchemaV1(Schema.Struct({ value: Schema.Number }));

// `makeQuery` (not bare `execute`) so the read joins the ambient
// transaction when one exists — this query is dispatched by
// a policy check during a command's authorization, inside its unit
// of work.
export const findMembershipHandler = Effect.fn("findMembershipHandler")(function* (
  query: FindMembershipPayload,
) {
  const db = yield* Database.Database;
  const readCount = db.makeQuery((execute) =>
    execute((client) =>
      client.one(sql.type(CountRowStd)`
          SELECT COUNT(*)::int AS value FROM "organization".memberships
          WHERE user_id = ${query.userId} AND organization_id = ${query.organizationId}
        `),
    ),
  );
  const row = yield* readCount().pipe(translateDatabaseErrors);
  return { isMember: row.value > 0 };
});
