import { Database, RowSchemas } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { RolesRepository } from "@/modules/role/domain/roles/roles.repository.js";
import { type RolesRoot } from "@/modules/role/domain/roles/roles.root.js";
import * as RoleMapper from "@/modules/role/infrastructure/repositories/role.mapper.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

export const RolesRepositoryLive = Layer.effect(
  RolesRepository,
  Effect.gen(function* () {
    const sql = yield* Database.Database;

    // Aggregate persistence: replace the user's row set with whatever the
    // aggregate now holds. `withTransaction` is depth-aware — it joins the
    // command's unit of work when one is open and opens its own transaction
    // otherwise, so the DELETE and the INSERT are always atomic together.
    const upsertOne = Effect.fn("RolesRepository.upsertOne")((roles: RolesRoot) =>
      sql
        .withTransaction(
          Effect.gen(function* () {
            yield* sql`DELETE FROM platform.roles WHERE user_id = ${roles.userId}`;
            // One statement rather than one per role. `unnest` over an empty
            // array yields zero rows, so the revoke-everything case needs no
            // guard.
            yield* sql`
              INSERT INTO platform.roles (user_id, role)
              SELECT ${roles.userId}, role
              FROM unnest(${roles.roles}::text[]) AS role
            `;
          }),
        )
        .pipe(Database.mapSqlError, translateDatabaseErrors),
    );

    // The spec pins the user id, so every matched row belongs to one aggregate;
    // the mapper groups them (or returns null for zero rows). The compiler
    // contributes only the WHERE — this repo owns the projection and, for a
    // multi-row aggregate, the reconstitution.
    const findOne = Effect.fn("RolesRepository.findOne")((spec: Specification<RolesRoot>) =>
      sql`
          SELECT user_id, role, granted_at
          FROM platform.roles
          WHERE ${criteriaToWhere(sql, spec.criteria, RoleMapper.columns)}
        `.pipe(
        Database.rows(RowSchemas.PlatformRoleRow),

        Effect.map((rows) => RoleMapper.toDomain(rows)),
        translateDatabaseErrors,
      ),
    );

    return RolesRepository.of({ upsertOne, findOne });
  }),
);
