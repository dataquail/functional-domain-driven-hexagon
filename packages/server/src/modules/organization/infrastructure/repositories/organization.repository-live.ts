import { Database, orFail, RowSchemas } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { OrganizationNotFound } from "@/modules/organization/domain/organization/organization.errors.js";
import { OrganizationRepository } from "@/modules/organization/domain/organization/organization.repository.js";
import { type OrganizationRoot } from "@/modules/organization/domain/organization/organization.root.js";
import * as OrganizationMapper from "@/modules/organization/infrastructure/repositories/organization.mapper.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

export const OrganizationRepositoryLive = Layer.effect(
  OrganizationRepository,
  Effect.gen(function* () {
    const sql = yield* Database.Database;

    const insertOne = Effect.fn("OrganizationRepository.insertOne")((
      organization: OrganizationRoot,
    ) => {
      const row = OrganizationMapper.toPersistence(organization);
      return sql`
          INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
          VALUES (
            ${row.id},
            ${row.name},
            ${row.created_at},
            ${row.updated_at},
            ${row.deleted_at}
          )
        `.pipe(Database.exec, translateDatabaseErrors);
    });

    const updateOne = Effect.fn("OrganizationRepository.updateOne")((
      organization: OrganizationRoot,
    ) => {
      const row = OrganizationMapper.toPersistence(organization);
      return sql`
          UPDATE "organization".organizations SET
            name = ${row.name},
            updated_at = ${row.updated_at},
            deleted_at = ${row.deleted_at}
          WHERE id = ${row.id}
          RETURNING *
        `.pipe(
        Database.maybeRow(RowSchemas.OrganizationRow),

        orFail(() => new OrganizationNotFound({ organizationId: organization.id })),
        Effect.asVoid,
        translateDatabaseErrors,
      );
    });

    // The spec contributes only the WHERE (identity, and — for active-only
    // reads — `deleted_at IS NULL`); the repository owns FROM and projection.
    // `LIMIT 1` is safe because every spec used with findOne selects at most
    // one row (identity keys).
    const findOne = Effect.fn("OrganizationRepository.findOne")(
      (spec: Specification<OrganizationRoot>) =>
        sql`
          SELECT * FROM "organization".organizations
          WHERE ${criteriaToWhere(sql, spec.criteria, OrganizationMapper.columns)}
          LIMIT 1
        `.pipe(
          Database.maybeRow(RowSchemas.OrganizationRow),

          Effect.map((row) => (row === null ? null : OrganizationMapper.toDomain(row))),
          translateDatabaseErrors,
        ),
    );

    return OrganizationRepository.of({
      insertOne,
      updateOne,
      findOne,
    });
  }),
);
