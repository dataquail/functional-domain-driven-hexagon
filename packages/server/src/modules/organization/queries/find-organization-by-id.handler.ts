import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.ts";
import { translateDatabaseErrors } from "@/globals/infrastructure/database/translate-database-errors.ts";
import {
  type FindOrganizationByIdPayload,
  type OrganizationAuthzView,
} from "@/modules/organization/queries/find-organization-by-id.query.ts";

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

  return Option.map(
    row,
    (found): OrganizationAuthzView => ({ organizationId: OrganizationId.make(found.id) }),
  );
});
