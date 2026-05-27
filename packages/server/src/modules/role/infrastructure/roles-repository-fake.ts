import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

import { RolesRepository } from "@/modules/role/domain/ports/repositories/roles-repository.js";
import { empty as emptyRoles, type Roles } from "@/modules/role/domain/roles.aggregate.js";
import { type UserId } from "@/platform/ids/user-id.js";

// In-memory `RolesRepository` for use-case unit tests. Composes with
// `IdentityUnitOfWork` and `RecordingEventBus` the same way
// `UserRepositoryFake` does.
export const RolesRepositoryFake = Layer.effect(
  RolesRepository,
  Effect.gen(function* () {
    const store = yield* Ref.make(HashMap.empty<UserId, Roles>());

    const save = (roles: Roles): Effect.Effect<void> =>
      Ref.update(store, HashMap.set(roles.userId, roles));

    const findByUserId = (userId: UserId): Effect.Effect<Roles> =>
      Effect.map(Ref.get(store), (m) => {
        const found = HashMap.get(m, userId);
        return found._tag === "Some" ? found.value : emptyRoles(userId);
      });

    return RolesRepository.of({ save, findByUserId });
  }),
);
