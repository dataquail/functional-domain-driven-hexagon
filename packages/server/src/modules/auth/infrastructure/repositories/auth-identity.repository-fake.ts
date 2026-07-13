import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

import {
  type AuthIdentity,
  AuthIdentityRepository,
} from "@/modules/auth/domain/auth-identity/auth-identity.repository.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";

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

      // The spec IS the in-memory predicate — the same object the live repo
      // compiles to SQL — so fake and live agree by construction.
      const findOne = (spec: Specification<AuthIdentity>): Effect.Effect<AuthIdentity | null> =>
        Effect.map(Ref.get(store), (m) => Array.from(HashMap.values(m)).find(spec) ?? null);

      const insertOne = (identity: AuthIdentity): Effect.Effect<void> =>
        Ref.update(store, (m) => HashMap.set(m, identity.subject, identity));

      return AuthIdentityRepository.of({ findOne, insertOne });
    }),
  );

export const AuthIdentityRepositoryFake = makeAuthIdentityRepositoryFake();
