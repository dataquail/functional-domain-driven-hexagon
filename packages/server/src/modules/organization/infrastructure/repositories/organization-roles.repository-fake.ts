import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

import { OrganizationRolesRepository } from "@/modules/organization/domain/organization-roles/organization-roles.repository.js";
import { type OrganizationRolesRoot } from "@/modules/organization/domain/organization-roles/organization-roles.root.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";
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

    // Mirror the live repo's row model: it persists as DELETE-then-INSERT, so
    // an aggregate with no roles leaves zero rows — indistinguishable from an
    // absent one. Storing an empty aggregate here would make findOne return it
    // where the live repo returns null, so an empty upsert deletes the entry.
    const upsertOne = (organizationRoles: OrganizationRolesRoot): Effect.Effect<void> =>
      Ref.update(
        store,
        organizationRoles.roles.length === 0
          ? HashMap.remove(key(organizationRoles.userId, organizationRoles.organizationId))
          : HashMap.set(
              key(organizationRoles.userId, organizationRoles.organizationId),
              organizationRoles,
            ),
      );

    // The spec is the in-memory predicate over the whole aggregate — the same
    // object the live repo compiles to SQL. Absence is `null`; the caller maps
    // it to an empty aggregate.
    const findOne = (
      spec: Specification<OrganizationRolesRoot>,
    ): Effect.Effect<OrganizationRolesRoot | null> =>
      Effect.map(Ref.get(store), (m) => Array.from(HashMap.values(m)).find(spec) ?? null);

    return OrganizationRolesRepository.of({ upsertOne, findOne });
  }),
);
