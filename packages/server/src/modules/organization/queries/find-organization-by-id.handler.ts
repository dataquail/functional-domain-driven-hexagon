import { Database, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import {
  type FindOrganizationByIdPayload,
  type OrganizationAuthzView,
} from "@/modules/organization/queries/find-organization-by-id.query.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

const IdRowStd = Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.String }));

// `makeQuery` (not bare `execute`) so the read joins the ambient transaction when
// one exists — the authz resolver runs this during a command's authorization,
// inside that command's unit of work.
export const findOrganizationByIdHandler = Effect.fn("findOrganizationByIdHandler")(function* (
  query: FindOrganizationByIdPayload,
) {
  const db = yield* Database.Database;
  const readOrganization = db.makeQuery((execute) =>
    execute((client) =>
      client.maybeOne(sql.type(IdRowStd)`
        SELECT id FROM "organization".organizations
        WHERE id = ${query.organizationId}
      `),
    ),
  );
  const row = yield* readOrganization().pipe(translateDatabaseErrors);
  return row === null
    ? null
    : ({ organizationId: OrganizationId.make(row.id) } satisfies OrganizationAuthzView);
});
