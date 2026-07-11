import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";

import { AuthIdentityNotFound } from "@/modules/auth/domain/auth-identity/auth-identity.errors.js";
import {
  type AuthIdentity,
  AuthIdentityRepository,
} from "@/modules/auth/domain/auth-identity/auth-identity.repository.js";

// The fake exposes a constructor that accepts initial state so tests can
// seed identities up front, and an in-memory `insert` mirroring the live
// write path used by JIT provisioning on first OIDC sign-in.
export const makeAuthIdentityRepositoryFake = (
  seed: ReadonlyArray<AuthIdentity> = [],
): Layer.Layer<AuthIdentityRepository> =>
  Layer.effect(
    AuthIdentityRepository,
    Effect.gen(function* () {
      const initial = HashMap.fromIterable(seed.map((i) => [i.subject, i] as const));
      const store = yield* Ref.make(initial);

      const findOneBySubject = (
        subject: string,
      ): Effect.Effect<AuthIdentity, AuthIdentityNotFound> =>
        Effect.flatMap(Ref.get(store), (m) =>
          Option.match(HashMap.get(m, subject), {
            onNone: () => Effect.fail(new AuthIdentityNotFound({ subject })),
            onSome: Effect.succeed,
          }),
        );

      const insertOne = (identity: AuthIdentity): Effect.Effect<void> =>
        Ref.update(store, (m) => HashMap.set(m, identity.subject, identity));

      return AuthIdentityRepository.of({ findOneBySubject, insertOne });
    }),
  );

export const AuthIdentityRepositoryFake = makeAuthIdentityRepositoryFake();
