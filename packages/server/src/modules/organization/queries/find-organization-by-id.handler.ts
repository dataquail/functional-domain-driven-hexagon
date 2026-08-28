import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import {
  type FindOrganizationByIdPayload,
  type OrganizationAuthzView,
} from "@/modules/organization/queries/find-organization-by-id.query.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

const IdRow = Schema.Struct({ id: Schema.String });

export const findOrganizationByIdHandler = Effect.fn("findOrganizationByIdHandler")(function* (
  query: FindOrganizationByIdPayload,
) {
  const sql = yield* Database.Database;
  const statement = sql`
        SELECT id FROM "organization".organizations
        WHERE id = ${query.organizationId}
      `.pipe(Database.maybeRow(IdRow));
  const row = yield* statement.pipe(translateDatabaseErrors);
  return row === null
    ? null
    : ({ organizationId: OrganizationId.make(row.id) } satisfies OrganizationAuthzView);
});
