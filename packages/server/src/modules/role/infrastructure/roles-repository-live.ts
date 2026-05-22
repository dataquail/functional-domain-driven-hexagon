import { Database, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { type Roles } from "@/modules/role/domain/roles.aggregate.js";
import { RolesRepository } from "@/modules/role/domain/roles-repository.js";
import * as RoleMapper from "@/modules/role/infrastructure/role-mapper.js";
import { type UserId } from "@/platform/ids/user-id.js";
import { translatePersistenceUnavailable } from "@/platform/translate-persistence-unavailable.js";

export const RolesRepositoryLive = Layer.effect(
  RolesRepository,
  Effect.gen(function* () {
    const db = yield* Database.Database;

    // Aggregate persistence: replace the user's row set with whatever
    // the aggregate now holds. Two statements (DELETE + INSERTs) sharing
    // the active TransactionContext — the command handler always wraps
    // saves in a UnitOfWork, so atomicity is the caller's concern. With
    // a handful of roles per user the DELETE-then-INSERT shape stays
    // cheap.
    const save = db.makeQuery((execute, roles: Roles) =>
      Effect.gen(function* () {
        yield* execute((client) =>
          client.query(sql.unsafe`
            DELETE FROM platform.roles WHERE user_id = ${roles.userId}
          `),
        );
        for (const role of roles.roles) {
          yield* execute((client) =>
            client.query(sql.unsafe`
              INSERT INTO platform.roles (user_id, role)
              VALUES (${roles.userId}, ${role})
            `),
          );
        }
      }).pipe(
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("RolesRepository.save"),
      ),
    );

    const findByUserId = db.makeQuery((execute, userId: UserId) =>
      execute((client) =>
        client.any(sql.type(RowSchemas.PlatformRoleRowStd)`
          SELECT user_id, role, granted_at FROM platform.roles WHERE user_id = ${userId}
        `),
      ).pipe(
        Effect.map((rows) => RoleMapper.toDomain(userId, rows)),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("RolesRepository.findByUserId"),
      ),
    );

    return RolesRepository.of({ save, findByUserId });
  }),
);
