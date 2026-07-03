import { Database, orFail, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  type AuthIdentity,
  AuthIdentityRepository,
} from "@/modules/auth/domain/ports/repositories/auth-identity.repository.js";
import { AuthIdentityNotFound } from "@/modules/auth/domain/session.errors.js";
import { translatePersistenceUnavailable } from "@/platform/translate-persistence-unavailable.js";

import * as AuthIdentityMapper from "./auth-identity.mapper.js";

export const AuthIdentityRepositoryLive = Layer.effect(
  AuthIdentityRepository,
  Effect.gen(function* () {
    const db = yield* Database.Database;

    const findOneBySubject = db.makeQuery((execute, subject: string) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.AuthIdentityRowStd)`
          SELECT * FROM auth.auth_identities WHERE subject = ${subject}
        `),
      ).pipe(
        orFail(() => new AuthIdentityNotFound({ subject })),
        Effect.map(AuthIdentityMapper.toDomain),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("AuthIdentityRepository.findOneBySubject"),
      ),
    );

    const insertOne = db.makeQuery((execute, identity: AuthIdentity) =>
      execute((client) =>
        client.query(sql.unsafe`
          INSERT INTO auth.auth_identities (subject, user_id, provider, created_at)
          VALUES (${identity.subject}, ${identity.userId}, ${identity.provider}, now())
        `),
      ).pipe(
        Effect.asVoid,
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("AuthIdentityRepository.insertOne"),
      ),
    );

    return AuthIdentityRepository.of({ findOneBySubject, insertOne });
  }),
);
