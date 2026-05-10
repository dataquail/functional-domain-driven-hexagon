import { FakeDatabaseRelaxedLive, FakeDatabaseTag } from "@/test-utils/fake-database.js";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { type AuthIdentity, AuthIdentityRepository } from "../domain/auth-identity-repository.js";
import { AuthIdentityNotFound } from "../domain/session-errors.js";

// `AuthIdentityRepository` is read-only on the public contract —
// production inserts happen out-of-band via the seed script (admin
// pre-seeded; non-admin JIT is a documented evolution). The shared
// variant therefore only exposes `findBySubject`; tests that need to
// seed identities can either pass a `seed` to
// `makeAuthIdentityRepositoryFake` or call `db.insertAuthIdentity(...)`
// directly when working with a shared `FakeDatabase`.
export const AuthIdentityRepositoryFakeShared: Layer.Layer<
  AuthIdentityRepository,
  never,
  FakeDatabaseTag
> = Layer.effect(
  AuthIdentityRepository,
  Effect.gen(function* () {
    const db = yield* FakeDatabaseTag;

    const findBySubject = (subject: string): Effect.Effect<AuthIdentity, AuthIdentityNotFound> => {
      const identity = db.authIdentities.get(subject);
      return identity === undefined
        ? Effect.fail(new AuthIdentityNotFound({ subject }))
        : Effect.succeed(identity);
    };

    return AuthIdentityRepository.of({ findBySubject });
  }),
);

// Backward-compatible seedable constructor used by existing tests
// (`makeAuthIdentityRepositoryFake([alice, bob])`). The seed pushes
// rows straight into a private `FakeDatabase` — these tests don't
// care about FK enforcement, only about the lookup behavior.
export const makeAuthIdentityRepositoryFake = (
  seed: ReadonlyArray<AuthIdentity> = [],
): Layer.Layer<AuthIdentityRepository> => {
  const Seeded = Layer.effect(
    AuthIdentityRepository,
    Effect.gen(function* () {
      const db = yield* FakeDatabaseTag;
      for (const identity of seed) {
        db.authIdentities.set(identity.subject, identity);
      }
      const findBySubject = (
        subject: string,
      ): Effect.Effect<AuthIdentity, AuthIdentityNotFound> => {
        const found = db.authIdentities.get(subject);
        return found === undefined
          ? Effect.fail(new AuthIdentityNotFound({ subject }))
          : Effect.succeed(found);
      };
      return AuthIdentityRepository.of({ findBySubject });
    }),
  );
  return Seeded.pipe(Layer.provide(FakeDatabaseRelaxedLive));
};

export const AuthIdentityRepositoryFake = makeAuthIdentityRepositoryFake();
