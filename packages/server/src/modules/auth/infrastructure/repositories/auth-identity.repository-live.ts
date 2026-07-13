import { Database, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  type AuthIdentity,
  AuthIdentityRepository,
} from "@/modules/auth/domain/auth-identity/auth-identity.repository.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
import { translatePersistenceUnavailable } from "@/platform/translate-persistence-unavailable.js";

import * as AuthIdentityMapper from "./auth-identity.mapper.js";

export const AuthIdentityRepositoryLive = Layer.effect(
  AuthIdentityRepository,
  Effect.gen(function* () {
    const db = yield* Database.Database;

    // The spec contributes only the WHERE; the repository owns FROM and the
    // projection. `LIMIT 1` is safe because every spec used with findOne
    // selects at most one row (the unique subject).
    const findOne = db.makeQuery((execute, spec: Specification<AuthIdentity>) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.AuthIdentityRowStd)`
          SELECT * FROM auth.auth_identities
          WHERE ${criteriaToWhere(spec.criteria, AuthIdentityMapper.columns)}
          LIMIT 1
        `),
      ).pipe(
        Effect.map((row) => (row === null ? null : AuthIdentityMapper.toDomain(row))),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("AuthIdentityRepository.findOne"),
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

    return AuthIdentityRepository.of({ findOne, insertOne });
  }),
);
