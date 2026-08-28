import { Database, RowSchemas } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { OrganizationRolesRepository } from "@/modules/organization/domain/organization-roles/organization-roles.repository.js";
import { type OrganizationRolesRoot } from "@/modules/organization/domain/organization-roles/organization-roles.root.js";
import * as OrganizationRolesMapper from "@/modules/organization/infrastructure/repositories/organization-roles.mapper.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

export const OrganizationRolesRepositoryLive = Layer.effect(
  OrganizationRolesRepository,
  Effect.gen(function* () {
    const sql = yield* Database.Database;

    // Aggregate persistence: replace the (user, org) row set with whatever the
    // aggregate now holds. `withTransaction` is depth-aware — it joins the
    // command's unit of work when one is open and opens its own transaction
    // otherwise, so the DELETE and the INSERT are always atomic together.
    const upsertOne = Effect.fn("OrganizationRolesRepository.upsertOne")(
      (organizationRoles: OrganizationRolesRoot) =>
        sql
          .withTransaction(
            Effect.gen(function* () {
              yield* sql`
                DELETE FROM "organization".organization_roles
                WHERE user_id = ${organizationRoles.userId}
                  AND organization_id = ${organizationRoles.organizationId}
              `;
              // One statement rather than one per role. The two arrays are
              // unnested in lockstep, so `role` and `issued_by` stay paired; an
              // empty aggregate yields zero rows, so the revoke-everything case
              // needs no guard.
              yield* sql`
                INSERT INTO "organization".organization_roles
                  (organization_id, user_id, role, issued_by)
                SELECT
                  ${organizationRoles.organizationId},
                  ${organizationRoles.userId},
                  granted.role,
                  granted.issued_by
                FROM unnest(
                  ${organizationRoles.roles.map((r) => r.role)}::text[],
                  ${organizationRoles.roles.map((r) => r.issuedBy)}::uuid[]
                ) AS granted(role, issued_by)
              `;
            }),
          )
          .pipe(Database.mapSqlError, translateDatabaseErrors),
    );

    // The spec pins the composite key, so every matched row belongs to one
    // aggregate; the mapper groups them (or returns null for zero rows). The
    // compiler contributes only the WHERE — this repo owns the projection and,
    // for a multi-row aggregate, the reconstitution.
    const findOne = Effect.fn("OrganizationRolesRepository.findOne")(
      (spec: Specification<OrganizationRolesRoot>) =>
        sql`
          SELECT organization_id, user_id, role, issued_by, created_at
          FROM "organization".organization_roles
          WHERE ${criteriaToWhere(sql, spec.criteria, OrganizationRolesMapper.columns)}
        `.pipe(
          Database.rows(RowSchemas.OrganizationRoleRow),
          Effect.map((rows) => OrganizationRolesMapper.toDomain(rows)),
          translateDatabaseErrors,
        ),
    );

    return OrganizationRolesRepository.of({ upsertOne, findOne });
  }),
);
