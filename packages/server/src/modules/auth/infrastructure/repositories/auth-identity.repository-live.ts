import { Database, RowSchemas } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  type AuthIdentity,
  AuthIdentityRepository,
} from "@/modules/auth/domain/auth-identity/auth-identity.repository.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

import * as AuthIdentityMapper from "./auth-identity.mapper.js";

export const AuthIdentityRepositoryLive = Layer.effect(
  AuthIdentityRepository,
  Effect.gen(function* () {
    const sql = yield* Database.Database;

    // The spec contributes only the WHERE; the repository owns FROM and the
    // projection. `LIMIT 1` is safe because every spec used with findOne
    // selects at most one row (the unique subject).
    const findOne = Effect.fn("AuthIdentityRepository.findOne")(
      (spec: Specification<AuthIdentity>) =>
        sql`
          SELECT * FROM auth.auth_identities
          WHERE ${criteriaToWhere(sql, spec.criteria, AuthIdentityMapper.columns)}
          LIMIT 1
        `.pipe(
          Database.maybeRow(RowSchemas.AuthIdentityRow),

          Effect.map((row) => (row === null ? null : AuthIdentityMapper.toDomain(row))),
          translateDatabaseErrors,
        ),
    );

    const insertOne = Effect.fn("AuthIdentityRepository.insertOne")((identity: AuthIdentity) =>
      sql`
          INSERT INTO auth.auth_identities (subject, user_id, provider, created_at)
          VALUES (${identity.subject}, ${identity.userId}, ${identity.provider}, now())
        `.pipe(Database.exec, translateDatabaseErrors),
    );

    return AuthIdentityRepository.of({ findOne, insertOne });
  }),
);
