import { Database, orFail, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { OrganizationNotFound } from "@/modules/organization/domain/organization/organization.errors.js";
import { OrganizationRepository } from "@/modules/organization/domain/organization/organization.repository.js";
import { type OrganizationRoot } from "@/modules/organization/domain/organization/organization.root.js";
import * as OrganizationMapper from "@/modules/organization/infrastructure/repositories/organization.mapper.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
import { translatePersistenceUnavailable } from "@/platform/translate-persistence-unavailable.js";

export const OrganizationRepositoryLive = Layer.effect(
  OrganizationRepository,
  Effect.gen(function* () {
    const db = yield* Database.Database;

    const insertOne = db.makeQuery((execute, organization: OrganizationRoot) => {
      const row = OrganizationMapper.toPersistence(organization);
      return execute((client) =>
        client.query(sql.unsafe`
          INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
          VALUES (
            ${row.id},
            ${row.name},
            ${sql.timestamp(row.created_at)},
            ${sql.timestamp(row.updated_at)},
            ${row.deleted_at === null ? null : sql.timestamp(row.deleted_at)}
          )
        `),
      ).pipe(
        Effect.asVoid,
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("OrganizationRepository.insertOne"),
      );
    });

    const updateOne = db.makeQuery((execute, organization: OrganizationRoot) => {
      const row = OrganizationMapper.toPersistence(organization);
      return execute((client) =>
        client.maybeOne(sql.type(RowSchemas.OrganizationRowStd)`
          UPDATE "organization".organizations SET
            name = ${row.name},
            updated_at = ${sql.timestamp(row.updated_at)},
            deleted_at = ${row.deleted_at === null ? null : sql.timestamp(row.deleted_at)}
          WHERE id = ${row.id}
          RETURNING *
        `),
      ).pipe(
        orFail(() => new OrganizationNotFound({ organizationId: organization.id })),
        Effect.asVoid,
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("OrganizationRepository.updateOne"),
      );
    });

    // The spec contributes only the WHERE (identity, and — for active-only
    // reads — `deleted_at IS NULL`); the repository owns FROM and projection.
    // `LIMIT 1` is safe because every spec used with findOne selects at most
    // one row (identity keys).
    const findOne = db.makeQuery((execute, spec: Specification<OrganizationRoot>) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.OrganizationRowStd)`
          SELECT * FROM "organization".organizations
          WHERE ${criteriaToWhere(spec.criteria, OrganizationMapper.columns)}
          LIMIT 1
        `),
      ).pipe(
        Effect.map((row) => (row === null ? null : OrganizationMapper.toDomain(row))),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("OrganizationRepository.findOne"),
      ),
    );

    return OrganizationRepository.of({
      insertOne,
      updateOne,
      findOne,
    });
  }),
);
