import { Database, orFail, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { UserAlreadyExists, UserNotFound } from "../domain/user-errors.js";
import { type UserId } from "../domain/user-id.js";
import { UserRepository } from "../domain/user-repository.js";
import { type User } from "../domain/user.js";
import * as UserMapper from "./user-mapper.js";

export const UserRepositoryLive = Layer.effect(
  UserRepository,
  Effect.gen(function* () {
    const db = yield* Database.Database;

    const insert = db.makeQuery((execute, user: User) => {
      const row = UserMapper.toPersistence(user);
      return execute((client) =>
        client.query(sql.unsafe`
          INSERT INTO users (id, email, role, country, street, postal_code, created_at, updated_at)
          VALUES (
            ${row.id},
            ${row.email},
            ${row.role},
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
        Effect.withSpan("UserRepository.insert"),
      );
    });

    const update = db.makeQuery((execute, user: User) => {
      const row = UserMapper.toPersistence(user);
      return execute((client) =>
        client.maybeOne(sql.type(RowSchemas.UserRowStd)`
          UPDATE users SET
            email = ${row.email},
            role = ${row.role},
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
        Effect.withSpan("UserRepository.update"),
      );
    });

    const remove = db.makeQuery((execute, id: UserId) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.UserRowStd)`
          DELETE FROM users WHERE id = ${id} RETURNING *
        `),
      ).pipe(
        orFail(() => new UserNotFound({ userId: id })),
        Effect.asVoid,
        Effect.catchTag("DatabaseError", Effect.die),
        Effect.withSpan("UserRepository.remove"),
      ),
    );

    const findById = db.makeQuery((execute, id: UserId) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.UserRowStd)`
          SELECT * FROM users WHERE id = ${id}
        `),
      ).pipe(
        orFail(() => new UserNotFound({ userId: id })),
        Effect.map(UserMapper.toDomain),
        Effect.catchTag("DatabaseError", Effect.die),
        Effect.withSpan("UserRepository.findById"),
      ),
    );

    const findByEmail = db.makeQuery((execute, email: string) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.UserRowStd)`
          SELECT * FROM users WHERE email = ${email}
        `),
      ).pipe(
        Effect.map((row) => (row === null ? Option.none() : Option.some(UserMapper.toDomain(row)))),
        Effect.catchTag("DatabaseError", Effect.die),
        Effect.withSpan("UserRepository.findByEmail"),
      ),
    );

    return UserRepository.of({ insert, update, remove, findById, findByEmail });
  }),
);
