import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

import { MembershipNotFound } from "@/modules/organization/domain/membership/membership.errors.js";
import { MembershipRepository } from "@/modules/organization/domain/membership/membership.repository.js";
import { type MembershipRoot } from "@/modules/organization/domain/membership/membership.root.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";
import { type UserId } from "@/platform/ids/user-id.js";

// Keyed by composite PK serialized as "<userId>|<organizationId>" — the
// HashMap value carries the full MembershipRoot so reads round-trip.
const key = (userId: UserId, organizationId: OrganizationId): string =>
  `${userId}|${organizationId}`;

export const MembershipRepositoryFake = Layer.effect(
  MembershipRepository,
  Effect.gen(function* () {
    const store = yield* Ref.make(HashMap.empty<string, MembershipRoot>());

    // Idempotent — mirrors the Live's ON CONFLICT DO NOTHING.
    const insertOne = (membership: MembershipRoot): Effect.Effect<void> =>
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

    // The spec IS the in-memory predicate — the same object the live repo
    // compiles to SQL — so fake and live agree by construction.
    const findOne = (spec: Specification<MembershipRoot>): Effect.Effect<MembershipRoot | null> =>
      Effect.map(Ref.get(store), (m) => Array.from(HashMap.values(m)).find(spec) ?? null);

    return MembershipRepository.of({
      insertOne,
      deleteOne: deleteRow,
      findOne,
    });
  }),
);
