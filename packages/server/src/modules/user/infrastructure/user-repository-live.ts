import { Database, DbSchema } from "@org/database/index";
import * as d from "drizzle-orm";
import * as Array from "effect/Array";
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

    const insert = db.makeQuery((execute, user: User) =>
      execute((client) =>
        client.insert(DbSchema.usersTable).values(UserMapper.toPersistence(user)),
      ).pipe(
        Effect.asVoid,
        Effect.catchTag("DatabaseError", (e) =>
          e.type === "unique_violation"
            ? Effect.fail(new UserAlreadyExists({ email: user.email }))
            : Effect.die(e),
        ),
        Effect.withSpan("UserRepository.insert"),
      ),
    );

    const update = db.makeQuery((execute, user: User) =>
      execute((client) =>
        client
          .update(DbSchema.usersTable)
          .set(UserMapper.toPersistence(user))
          .where(d.eq(DbSchema.usersTable.id, user.id))
          .returning({ id: DbSchema.usersTable.id }),
      ).pipe(
        Effect.flatMap(Array.head),
        Effect.asVoid,
        Effect.catchTags({
          NoSuchElementException: () => Effect.fail(new UserNotFound({ userId: user.id })),
          DatabaseError: Effect.die,
        }),
        Effect.withSpan("UserRepository.update"),
      ),
    );

    const remove = db.makeQuery((execute, id: UserId) =>
      execute((client) =>
        client
          .delete(DbSchema.usersTable)
          .where(d.eq(DbSchema.usersTable.id, id))
          .returning({ id: DbSchema.usersTable.id }),
      ).pipe(
        Effect.flatMap(Array.head),
        Effect.asVoid,
        Effect.catchTags({
          NoSuchElementException: () => Effect.fail(new UserNotFound({ userId: id })),
          DatabaseError: Effect.die,
        }),
        Effect.withSpan("UserRepository.remove"),
      ),
    );

    const findById = db.makeQuery((execute, id: UserId) =>
      execute((client) =>
        client.query.usersTable.findFirst({
          where: d.eq(DbSchema.usersTable.id, id),
        }),
      ).pipe(
        Effect.flatMap((row) =>
          row === undefined
            ? Effect.fail(new UserNotFound({ userId: id }))
            : Effect.succeed(UserMapper.toDomain(row)),
        ),
        Effect.catchTag("DatabaseError", Effect.die),
        Effect.withSpan("UserRepository.findById"),
      ),
    );

    const findByEmail = db.makeQuery((execute, email: string) =>
      execute((client) =>
        client.query.usersTable.findFirst({
          where: d.eq(DbSchema.usersTable.email, email),
        }),
      ).pipe(
        Effect.map((row) =>
          row === undefined ? Option.none() : Option.some(UserMapper.toDomain(row)),
        ),
        Effect.catchTag("DatabaseError", Effect.die),
        Effect.withSpan("UserRepository.findByEmail"),
      ),
    );

    return UserRepository.of({ insert, update, remove, findById, findByEmail });
  }),
);
