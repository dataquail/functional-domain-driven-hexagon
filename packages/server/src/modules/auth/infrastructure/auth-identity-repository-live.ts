import { Database, orFail, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { AuthIdentityRepository } from "../domain/auth-identity-repository.js";
import { AuthIdentityNotFound } from "../domain/session-errors.js";
import * as AuthIdentityMapper from "./auth-identity-mapper.js";

export const AuthIdentityRepositoryLive = Layer.effect(
  AuthIdentityRepository,
  Effect.gen(function* () {
    const db = yield* Database.Database;

    const findBySubject = db.makeQuery((execute, subject: string) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.AuthIdentityRowStd)`
          SELECT * FROM auth_identities WHERE subject = ${subject}
        `),
      ).pipe(
        orFail(() => new AuthIdentityNotFound({ subject })),
        Effect.map(AuthIdentityMapper.toDomain),
        Effect.catchTag("DatabaseError", Effect.die),
        Effect.withSpan("AuthIdentityRepository.findBySubject"),
      ),
    );

    return AuthIdentityRepository.of({ findBySubject });
  }),
);
