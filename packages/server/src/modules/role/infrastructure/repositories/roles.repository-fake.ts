import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

import { RolesRepository } from "@/modules/role/domain/ports/repositories/roles.repository.js";
import { type RolesRoot } from "@/modules/role/domain/roles.root.js";
import { RolesRootOps } from "@/modules/role/domain/roles.root-ops.js";
import { type UserId } from "@/platform/ids/user-id.js";

// In-memory `RolesRepository` for use-case unit tests. Composes with
// `IdentityUnitOfWork` and `RecordingEventBus` the same way
// `UserRepositoryFake` does.
export const RolesRepositoryFake = Layer.effect(
  RolesRepository,
  Effect.gen(function* () {
    const store = yield* Ref.make(HashMap.empty<UserId, RolesRoot>());

    const upsertOne = (roles: RolesRoot): Effect.Effect<void> =>
      Ref.update(store, HashMap.set(roles.userId, roles));

    const findOneByUserId = (userId: UserId): Effect.Effect<RolesRoot> =>
      Effect.map(Ref.get(store), (m) => {
        const found = HashMap.get(m, userId);
        return found._tag === "Some" ? found.value : RolesRootOps.empty(userId);
      });

    return RolesRepository.of({ upsertOne, findOneByUserId });
  }),
);
