import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

import { OrganizationRolesRepository } from "@/modules/organization/domain/organization-roles/organization-roles.repository.js";
import { type OrganizationRolesRoot } from "@/modules/organization/domain/organization-roles/organization-roles.root.js";
import { OrganizationRolesRootOps } from "@/modules/organization/domain/organization-roles/organization-roles.root-ops.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";
import { type UserId } from "@/platform/ids/user-id.js";

// Keyed by composite identity serialized as "<userId>|<organizationId>".
// The HashMap value carries the full `OrganizationRolesRoot` aggregate so
// reads round-trip the entire set of roles (and their issuers).
const key = (userId: UserId, organizationId: OrganizationId): string =>
  `${userId}|${organizationId}`;

// In-memory `OrganizationRolesRepository` for use-case unit tests.
// Composes with `IdentityUnitOfWork` and `RecordingEventBus` the same
// way `RolesRepositoryFake` does.
export const OrganizationRolesRepositoryFake = Layer.effect(
  OrganizationRolesRepository,
  Effect.gen(function* () {
    const store = yield* Ref.make(HashMap.empty<string, OrganizationRolesRoot>());

    const upsertOne = (organizationRoles: OrganizationRolesRoot): Effect.Effect<void> =>
      Ref.update(
        store,
        HashMap.set(
          key(organizationRoles.userId, organizationRoles.organizationId),
          organizationRoles,
        ),
      );

    const findOneByUserIdAndOrgId = (
      userId: UserId,
      organizationId: OrganizationId,
    ): Effect.Effect<OrganizationRolesRoot> =>
      Effect.map(Ref.get(store), (m) => {
        const found = HashMap.get(m, key(userId, organizationId));
        return found._tag === "Some"
          ? found.value
          : OrganizationRolesRootOps.empty(userId, organizationId);
      });

    return OrganizationRolesRepository.of({ upsertOne, findOneByUserIdAndOrgId });
  }),
);
