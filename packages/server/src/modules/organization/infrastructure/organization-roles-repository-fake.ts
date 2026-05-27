import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

import {
  empty as emptyOrgRoles,
  type OrganizationRoles,
} from "@/modules/organization/domain/organization-roles.aggregate.js";
import { OrganizationRolesRepository } from "@/modules/organization/domain/ports/repositories/organization-roles-repository.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";
import { type UserId } from "@/platform/ids/user-id.js";

// Keyed by composite identity serialized as "<userId>|<organizationId>".
// The HashMap value carries the full `OrganizationRoles` aggregate so
// reads round-trip the entire set of roles (and their issuers).
const key = (userId: UserId, organizationId: OrganizationId): string =>
  `${userId}|${organizationId}`;

// In-memory `OrganizationRolesRepository` for use-case unit tests.
// Composes with `IdentityUnitOfWork` and `RecordingEventBus` the same
// way `RolesRepositoryFake` does.
export const OrganizationRolesRepositoryFake = Layer.effect(
  OrganizationRolesRepository,
  Effect.gen(function* () {
    const store = yield* Ref.make(HashMap.empty<string, OrganizationRoles>());

    const save = (organizationRoles: OrganizationRoles): Effect.Effect<void> =>
      Ref.update(
        store,
        HashMap.set(
          key(organizationRoles.userId, organizationRoles.organizationId),
          organizationRoles,
        ),
      );

    const findByUserIdAndOrgId = (
      userId: UserId,
      organizationId: OrganizationId,
    ): Effect.Effect<OrganizationRoles> =>
      Effect.map(Ref.get(store), (m) => {
        const found = HashMap.get(m, key(userId, organizationId));
        return found._tag === "Some" ? found.value : emptyOrgRoles(userId, organizationId);
      });

    return OrganizationRolesRepository.of({ save, findByUserIdAndOrgId });
  }),
);
