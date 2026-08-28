import { Database, orFail, RowSchemas } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { UserAlreadyExists, UserNotFound } from "@/modules/user/domain/user/user.errors.js";
import { UserRepository } from "@/modules/user/domain/user/user.repository.js";
import { type UserRoot } from "@/modules/user/domain/user/user.root.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";
import { type UserId } from "@/platform/ids/user-id.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
import {
  translateDatabaseErrors,
  translatePersistenceUnavailable,
} from "@/platform/translate-database-errors.js";

import * as UserMapper from "./user.mapper.js";

export const UserRepositoryLive = Layer.effect(
  UserRepository,
  Effect.gen(function* () {
    const sql = yield* Database.Database;

    const insertOne = Effect.fn("UserRepository.insertOne")((user: UserRoot) => {
      const row = UserMapper.toPersistence(user);
      return sql`
          INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
          VALUES (
            ${row.id},
            ${row.email},
            ${row.country},
            ${row.street},
            ${row.postal_code},
            ${row.created_at},
            ${row.updated_at}
          )
        `.pipe(
        Database.exec,
        Effect.catchTag("DatabaseError", (e) =>
          e.type === "unique_violation"
            ? new UserAlreadyExists({ email: user.email })
            : Effect.die(e),
        ),
        translatePersistenceUnavailable,
      );
    });

    const updateOne = Effect.fn("UserRepository.updateOne")((user: UserRoot) => {
      const row = UserMapper.toPersistence(user);
      return sql`
          UPDATE "user".users SET
            email = ${row.email},
            country = ${row.country},
            street = ${row.street},
            postal_code = ${row.postal_code},
            updated_at = ${row.updated_at}
          WHERE id = ${row.id}
          RETURNING *
        `.pipe(
        Database.maybeRow(RowSchemas.UserRow),

        orFail(() => new UserNotFound({ userId: user.id })),
        Effect.asVoid,
        translateDatabaseErrors,
      );
    });

    const deleteOne = Effect.fn("UserRepository.deleteOne")((id: UserId) =>
      sql`
          DELETE FROM "user".users WHERE id = ${id} RETURNING *
        `.pipe(
        Database.maybeRow(RowSchemas.UserRow),

        orFail(() => new UserNotFound({ userId: id })),
        Effect.asVoid,
        translateDatabaseErrors,
      ),
    );

    // The spec contributes only the WHERE; the repository owns FROM and the
    // projection. `LIMIT 1` is safe because every spec used with findOne
    // selects at most one row (the id primary key, the unique email).
    const findOne = Effect.fn("UserRepository.findOne")((spec: Specification<UserRoot>) =>
      sql`
          SELECT * FROM "user".users
          WHERE ${criteriaToWhere(sql, spec.criteria, UserMapper.columns)}
          LIMIT 1
        `.pipe(
        Database.maybeRow(RowSchemas.UserRow),

        Effect.map((row) => (row === null ? null : UserMapper.toDomain(row))),
        translateDatabaseErrors,
      ),
    );

    return UserRepository.of({ insertOne, updateOne, deleteOne, findOne });
  }),
);
