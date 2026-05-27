import { Database, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { type OrganizationRoles } from "@/modules/organization/domain/organization-roles.aggregate.js";
import { OrganizationRolesRepository } from "@/modules/organization/domain/ports/repositories/organization-roles-repository.js";
import * as OrganizationRolesMapper from "@/modules/organization/infrastructure/organization-roles-mapper.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";
import { type UserId } from "@/platform/ids/user-id.js";
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
    const writeStatements = (organizationRoles: OrganizationRoles) =>
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

    const save = (organizationRoles: OrganizationRoles) =>
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
        Effect.withSpan("OrganizationRolesRepository.save"),
      );

    const findByUserIdAndOrgId = db.makeQuery(
      (execute, args: { userId: UserId; organizationId: OrganizationId }) =>
        execute((client) =>
          client.any(sql.type(RowSchemas.OrganizationRoleRowStd)`
            SELECT organization_id, user_id, role, issued_by, created_at
            FROM "organization".organization_roles
            WHERE user_id = ${args.userId}
              AND organization_id = ${args.organizationId}
          `),
        ).pipe(
          Effect.map((rows) =>
            OrganizationRolesMapper.toDomain(args.userId, args.organizationId, rows),
          ),
          Effect.catchTag("DatabaseError", Effect.die),
          translatePersistenceUnavailable,
          Effect.withSpan("OrganizationRolesRepository.findByUserIdAndOrgId"),
        ),
    );

    return OrganizationRolesRepository.of({
      save,
      findByUserIdAndOrgId: (userId, organizationId) =>
        findByUserIdAndOrgId({ userId, organizationId }),
    });
  }),
);
