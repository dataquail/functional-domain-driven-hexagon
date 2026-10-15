import { Database, RowSchemas } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { type Specification } from "@/globals/application/ddd/specification";
import { criteriaToWhere } from "@/globals/infrastructure/database/criteria-to-sql";
import { translateDatabaseErrors } from "@/globals/infrastructure/database/translate-database-errors";
import {
  type AuthIdentity,
  AuthIdentityRepository,
} from "@/modules/auth/domain/auth-identity/auth-identity.repository";

import * as AuthIdentityMapper from "./auth-identity.mapper";

export const AuthIdentityRepositoryLive = Layer.effect(
  AuthIdentityRepository,
  Effect.gen(function* () {
    const sql = yield* Database.Database;

    // The spec contributes only the WHERE; the repository owns FROM and the
    // projection. `LIMIT 1` is safe because every spec used with findOne
    // selects at most one row (the unique subject).
    const findOne = Effect.fn("AuthIdentityRepository.findOne")(
      (spec: Specification<AuthIdentity>) =>
        criteriaToWhere(sql, spec.criteria, AuthIdentityMapper.columns).pipe(
          Effect.flatMap(
            (where) => sql`
          SELECT * FROM auth.auth_identities
          WHERE ${where}
          LIMIT 1
        `,
          ),
          Database.maybeRow(RowSchemas.AuthIdentityRow),

          Effect.map(Option.map(AuthIdentityMapper.toDomain)),
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
