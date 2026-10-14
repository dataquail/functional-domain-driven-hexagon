import { Database, orFail, RowSchemas } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { type Specification } from "@/globals/application/ddd/specification.ts";
import { criteriaToWhere } from "@/globals/infrastructure/database/criteria-to-sql.ts";
import { translateDatabaseErrors } from "@/globals/infrastructure/database/translate-database-errors.ts";
import { OrganizationNotFound } from "@/modules/organization/domain/organization/organization.errors.ts";
import { OrganizationRepository } from "@/modules/organization/domain/organization/organization.repository.ts";
import { type OrganizationRoot } from "@/modules/organization/domain/organization/organization.root.ts";
import * as OrganizationMapper from "@/modules/organization/infrastructure/repositories/organization.mapper.ts";

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
        criteriaToWhere(sql, spec.criteria, OrganizationMapper.columns).pipe(
          Effect.flatMap(
            (where) => sql`
          SELECT * FROM "organization".organizations
          WHERE ${where}
          LIMIT 1
        `,
          ),
          Database.maybeRow(RowSchemas.OrganizationRow),
          Effect.map(Option.map(OrganizationMapper.toDomain)),
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
