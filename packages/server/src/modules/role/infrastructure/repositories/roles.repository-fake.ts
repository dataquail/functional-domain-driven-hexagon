import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

import { RolesRepository } from "@/modules/role/domain/roles/roles.repository.js";
import { type RolesRoot } from "@/modules/role/domain/roles/roles.root.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";
import { type UserId } from "@/platform/ids/user-id.js";

// In-memory `RolesRepository` for use-case unit tests. Composes with
// `IdentityUnitOfWork` and `RecordingEventBus` the same way
// `UserRepositoryFake` does.
export const RolesRepositoryFake = Layer.effect(
  RolesRepository,
  Effect.gen(function* () {
    const store = yield* Ref.make(HashMap.empty<UserId, RolesRoot>());

    // Mirror the live repo's row model: it persists as DELETE-then-INSERT, so
    // an aggregate with no roles leaves zero rows — indistinguishable from an
    // absent one. Storing an empty aggregate here would make findOne return it
    // where the live repo returns null, so an empty upsert deletes the entry.
    const upsertOne = (roles: RolesRoot): Effect.Effect<void> =>
      Ref.update(
        store,
        roles.roles.length === 0 ? HashMap.remove(roles.userId) : HashMap.set(roles.userId, roles),
      );

    // The spec is the in-memory predicate over the whole aggregate — the same
    // object the live repo compiles to SQL. Absence is `null`; the caller maps
    // it to an empty aggregate.
    const findOne = (spec: Specification<RolesRoot>): Effect.Effect<RolesRoot | null> =>
      Effect.map(Ref.get(store), (m) => Array.from(HashMap.values(m)).find(spec) ?? null);

    return RolesRepository.of({ upsertOne, findOne });
  }),
);
