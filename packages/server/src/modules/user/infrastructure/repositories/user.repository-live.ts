import { Database, orFail, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { UserRepository } from "@/modules/user/domain/ports/repositories/user.repository.js";
import { UserAlreadyExists, UserNotFound } from "@/modules/user/domain/user.errors.js";
import { type UserRoot } from "@/modules/user/domain/user.root.js";
import { type UserId } from "@/platform/ids/user-id.js";
import { translatePersistenceUnavailable } from "@/platform/translate-persistence-unavailable.js";

import * as UserMapper from "./user.mapper.js";

export const UserRepositoryLive = Layer.effect(
  UserRepository,
  Effect.gen(function* () {
    const db = yield* Database.Database;

    const insertOne = db.makeQuery((execute, user: UserRoot) => {
      const row = UserMapper.toPersistence(user);
      return execute((client) =>
        client.query(sql.unsafe`
          INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
          VALUES (
            ${row.id},
            ${row.email},
            ${row.country},
            ${row.street},
            ${row.postal_code},
            ${sql.timestamp(row.created_at)},
            ${sql.timestamp(row.updated_at)}
          )
        `),
      ).pipe(
        Effect.asVoid,
        Effect.catchTag("DatabaseError", (e) =>
          e.type === "unique_violation"
            ? Effect.fail(new UserAlreadyExists({ email: user.email }))
            : Effect.die(e),
        ),
        translatePersistenceUnavailable,
        Effect.withSpan("UserRepository.insertOne"),
      );
    });

    const updateOne = db.makeQuery((execute, user: UserRoot) => {
      const row = UserMapper.toPersistence(user);
      return execute((client) =>
        client.maybeOne(sql.type(RowSchemas.UserRowStd)`
          UPDATE "user".users SET
            email = ${row.email},
            country = ${row.country},
            street = ${row.street},
            postal_code = ${row.postal_code},
            updated_at = ${sql.timestamp(row.updated_at)}
          WHERE id = ${row.id}
          RETURNING *
        `),
      ).pipe(
        orFail(() => new UserNotFound({ userId: user.id })),
        Effect.asVoid,
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("UserRepository.updateOne"),
      );
    });

    const deleteOne = db.makeQuery((execute, id: UserId) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.UserRowStd)`
          DELETE FROM "user".users WHERE id = ${id} RETURNING *
        `),
      ).pipe(
        orFail(() => new UserNotFound({ userId: id })),
        Effect.asVoid,
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("UserRepository.deleteOne"),
      ),
    );

    const findOneById = db.makeQuery((execute, id: UserId) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.UserRowStd)`
          SELECT * FROM "user".users WHERE id = ${id}
        `),
      ).pipe(
        orFail(() => new UserNotFound({ userId: id })),
        Effect.map(UserMapper.toDomain),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("UserRepository.findOneById"),
      ),
    );

    const findOneByEmail = db.makeQuery((execute, email: string) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.UserRowStd)`
          SELECT * FROM "user".users WHERE email = ${email}
        `),
      ).pipe(
        Effect.map((row) => (row === null ? Option.none() : Option.some(UserMapper.toDomain(row)))),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("UserRepository.findOneByEmail"),
      ),
    );

    return UserRepository.of({ insertOne, updateOne, deleteOne, findOneById, findOneByEmail });
  }),
);
