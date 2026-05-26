import { Database, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { RolesRepository } from "@/modules/role/domain/ports/repositories/roles-repository.js";
import { type Roles } from "@/modules/role/domain/roles.aggregate.js";
import * as RoleMapper from "@/modules/role/infrastructure/role-mapper.js";
import { type UserId } from "@/platform/ids/user-id.js";
import { translatePersistenceUnavailable } from "@/platform/translate-persistence-unavailable.js";

export const RolesRepositoryLive = Layer.effect(
  RolesRepository,
  Effect.gen(function* () {
    const db = yield* Database.Database;

    // Aggregate persistence: replace the user's row set with whatever
    // the aggregate now holds. The DELETE + N INSERTs must run on the
    // same connection to be atomic. `db.makeQuery`'s ambient-vs-pool
    // resolution is per-call, so a bare invocation without an outer
    // `TransactionContext` would spread the statements across separate
    // pool connections and lose atomicity.
    //
    // Strategy: reuse `TransactionContext` if already in scope (the
    // command handler wrapped us in `UnitOfWork.run`) so the writes
    // compose with the outer transaction; otherwise open our own
    // `db.transaction` so the repo is internally atomic even when
    // called bare. Either way the statements share one connection.
    const writeStatements = (roles: Roles) =>
      Effect.gen(function* () {
        const tx = yield* Database.TransactionContext;
        yield* tx((client) =>
          client.query(sql.unsafe`
            DELETE FROM platform.roles WHERE user_id = ${roles.userId}
          `),
        );
        for (const role of roles.roles) {
          yield* tx((client) =>
            client.query(sql.unsafe`
              INSERT INTO platform.roles (user_id, role)
              VALUES (${roles.userId}, ${role})
            `),
          );
        }
      });

    const save = (roles: Roles) =>
      Effect.serviceOption(Database.TransactionContext).pipe(
        Effect.flatMap((existing) =>
          Option.isSome(existing)
            ? writeStatements(roles).pipe(Database.TransactionContext.provide(existing.value))
            : db.transaction((tx) =>
                writeStatements(roles).pipe(Database.TransactionContext.provide(tx)),
              ),
        ),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("RolesRepository.save"),
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
