import { Database, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { OrganizationRolesRepository } from "@/modules/organization/domain/organization-roles/organization-roles.repository.js";
import { type OrganizationRolesRoot } from "@/modules/organization/domain/organization-roles/organization-roles.root.js";
import * as OrganizationRolesMapper from "@/modules/organization/infrastructure/repositories/organization-roles.mapper.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
import { translatePersistenceUnavailable } from "@/platform/translate-persistence-unavailable.js";

export const OrganizationRolesRepositoryLive = Layer.effect(
  OrganizationRolesRepository,
  Effect.gen(function* () {
    const db = yield* Database.Database;

    // Aggregate persistence: replace the (user, org) row set with
    // whatever the aggregate now holds. The DELETE + N INSERTs must run
    // on the same connection to be atomic. Same strategy as
    // `RolesRepositoryLive.save` — reuse the ambient `TransactionContext`
    // if a `UnitOfWork.run` already opened one, otherwise open a private
    // `db.transaction` so the repo is internally atomic even when called
    // bare. Either way the statements share one connection.
    const writeStatements = (organizationRoles: OrganizationRolesRoot) =>
      Effect.gen(function* () {
        const tx = yield* Database.TransactionContext;
        yield* tx((client) =>
          client.query(sql.unsafe`
            DELETE FROM "organization".organization_roles
            WHERE user_id = ${organizationRoles.userId}
              AND organization_id = ${organizationRoles.organizationId}
          `),
        );
        for (const r of organizationRoles.roles) {
          yield* tx((client) =>
            client.query(sql.unsafe`
              INSERT INTO "organization".organization_roles
                (organization_id, user_id, role, issued_by)
              VALUES (
                ${organizationRoles.organizationId},
                ${organizationRoles.userId},
                ${r.role},
                ${r.issuedBy}
              )
            `),
          );
        }
      });

    const upsertOne = (organizationRoles: OrganizationRolesRoot) =>
      Effect.serviceOption(Database.TransactionContext).pipe(
        Effect.flatMap((existing) =>
          Option.isSome(existing)
            ? writeStatements(organizationRoles).pipe(
                Database.TransactionContext.provide(existing.value),
              )
            : db.transaction((tx) =>
                writeStatements(organizationRoles).pipe(Database.TransactionContext.provide(tx)),
              ),
        ),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("OrganizationRolesRepository.upsertOne"),
      );

    // The spec pins the composite key, so every matched row belongs to one
    // aggregate; the mapper groups them (or returns null for zero rows). The
    // compiler contributes only the WHERE — this repo owns the projection and,
    // for a multi-row aggregate, the reconstitution.
    const findOne = db.makeQuery((execute, spec: Specification<OrganizationRolesRoot>) =>
      execute((client) =>
        client.any(sql.type(RowSchemas.OrganizationRoleRowStd)`
          SELECT organization_id, user_id, role, issued_by, created_at
          FROM "organization".organization_roles
          WHERE ${criteriaToWhere(spec.criteria, OrganizationRolesMapper.columns)}
        `),
      ).pipe(
        Effect.map((rows) => OrganizationRolesMapper.toDomain(rows)),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("OrganizationRolesRepository.findOne"),
      ),
    );

    return OrganizationRolesRepository.of({ upsertOne, findOne });
  }),
);
