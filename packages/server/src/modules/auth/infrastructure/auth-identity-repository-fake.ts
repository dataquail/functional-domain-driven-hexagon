import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import { type AuthIdentity, AuthIdentityRepository } from "../domain/auth-identity-repository.js";
import { AuthIdentityNotFound } from "../domain/session-errors.js";

// `AuthIdentityRepository` is read-only on the public contract — production
// inserts happen out-of-band via the seed script (admin pre-seeded; non-admin
// JIT is a documented evolution). The fake therefore exposes a constructor
// that accepts initial state, so tests can seed identities without us having
// to extend the public contract with an `insert` we don't actually want.
export const makeAuthIdentityRepositoryFake = (
  seed: ReadonlyArray<AuthIdentity> = [],
): Layer.Layer<AuthIdentityRepository> =>
  Layer.effect(
    AuthIdentityRepository,
    Effect.gen(function* () {
      const initial = HashMap.fromIterable(seed.map((i) => [i.subject, i] as const));
      const store = yield* Ref.make(initial);

      const findBySubject = (subject: string): Effect.Effect<AuthIdentity, AuthIdentityNotFound> =>
        Effect.flatMap(Ref.get(store), (m) =>
          Option.match(HashMap.get(m, subject), {
            onNone: () => Effect.fail(new AuthIdentityNotFound({ subject })),
            onSome: Effect.succeed,
          }),
        );

      return AuthIdentityRepository.of({ findBySubject });
    }),
  );

export const AuthIdentityRepositoryFake = makeAuthIdentityRepositoryFake();
