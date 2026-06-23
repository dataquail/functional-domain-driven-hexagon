import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

import { type Membership } from "@/modules/organization/domain/membership.aggregate.js";
import { MembershipNotFound } from "@/modules/organization/domain/membership-errors.js";
import { MembershipRepository } from "@/modules/organization/domain/ports/repositories/membership-repository.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";
import { type UserId } from "@/platform/ids/user-id.js";

// Keyed by composite PK serialized as "<userId>|<organizationId>" — the
// HashMap value carries the full Membership so reads round-trip.
const key = (userId: UserId, organizationId: OrganizationId): string =>
  `${userId}|${organizationId}`;

export const MembershipRepositoryFake = Layer.effect(
  MembershipRepository,
  Effect.gen(function* () {
    const store = yield* Ref.make(HashMap.empty<string, Membership>());

    // Idempotent — mirrors the Live's ON CONFLICT DO NOTHING.
    const insert = (membership: Membership): Effect.Effect<void> =>
      Ref.update(store, (m) => {
        const k = key(membership.userId, membership.organizationId);
        return HashMap.has(m, k) ? m : HashMap.set(m, k, membership);
      });

    const deleteRow = (
      userId: UserId,
      organizationId: OrganizationId,
    ): Effect.Effect<void, MembershipNotFound> =>
      Effect.flatMap(Ref.get(store), (m) => {
        const k = key(userId, organizationId);
        if (!HashMap.has(m, k)) {
          return Effect.fail(new MembershipNotFound({ userId, organizationId }));
        }
        return Ref.update(store, HashMap.remove(k));
      });

    const findByUserIdAndOrgId = (
      userId: UserId,
      organizationId: OrganizationId,
    ): Effect.Effect<Membership, MembershipNotFound> =>
      Effect.flatMap(Ref.get(store), (m) => {
        const found = HashMap.get(m, key(userId, organizationId));
        return found._tag === "Some"
          ? Effect.succeed(found.value)
          : Effect.fail(new MembershipNotFound({ userId, organizationId }));
      });

    const findByOrganizationId = (
      organizationId: OrganizationId,
    ): Effect.Effect<ReadonlyArray<Membership>> =>
      Effect.map(Ref.get(store), (m) =>
        Array.from(HashMap.values(m)).filter((mem) => mem.organizationId === organizationId),
      );

    return MembershipRepository.of({
      insert,
      delete: deleteRow,
      findByUserIdAndOrgId,
      findByOrganizationId,
    });
  }),
);
