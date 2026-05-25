import { Database, orFail, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { type Organization } from "@/modules/organization/domain/organization.aggregate.js";
import { OrganizationNotFound } from "@/modules/organization/domain/organization-errors.js";
import { OrganizationRepository } from "@/modules/organization/domain/organization-repository.js";
import * as OrganizationMapper from "@/modules/organization/infrastructure/organization-mapper.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";
import { translatePersistenceUnavailable } from "@/platform/translate-persistence-unavailable.js";

export const OrganizationRepositoryLive = Layer.effect(
  OrganizationRepository,
  Effect.gen(function* () {
    const db = yield* Database.Database;

    const insert = db.makeQuery((execute, organization: Organization) => {
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
        Effect.withSpan("OrganizationRepository.insert"),
      );
    });

    const update = db.makeQuery((execute, organization: Organization) => {
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
        Effect.withSpan("OrganizationRepository.update"),
      );
    });

    // findById hides soft-deleted rows so consumers (commands, the
    // resource resolver registered for active-only flows) don't have to
    // remember to filter on `deleted_at IS NULL` themselves.
    const findById = db.makeQuery((execute, id: OrganizationId) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.OrganizationRowStd)`
          SELECT * FROM "organization".organizations
          WHERE id = ${id} AND deleted_at IS NULL
        `),
      ).pipe(
        orFail(() => new OrganizationNotFound({ organizationId: id })),
        Effect.map(OrganizationMapper.toDomain),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("OrganizationRepository.findById"),
      ),
    );

    // Explicit opt-in for the restore path and the super-admin
    // "include deleted" listing. Keeping the variant separate at the
    // port level documents that callers had to actively ask for
    // tombstones — same shape as the `with-deleted` boolean would
    // collapse to, but more discoverable.
    const findByIdIncludingDeleted = db.makeQuery((execute, id: OrganizationId) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.OrganizationRowStd)`
          SELECT * FROM "organization".organizations WHERE id = ${id}
        `),
      ).pipe(
        orFail(() => new OrganizationNotFound({ organizationId: id })),
        Effect.map(OrganizationMapper.toDomain),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("OrganizationRepository.findByIdIncludingDeleted"),
      ),
    );

    return OrganizationRepository.of({ insert, update, findById, findByIdIncludingDeleted });
  }),
);
