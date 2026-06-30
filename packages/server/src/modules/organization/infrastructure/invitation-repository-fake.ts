import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

import { type Invitation, isOpen } from "@/modules/organization/domain/invitation.aggregate.js";
import {
  InvitationNotFound,
  InvitationTokenNotFound,
} from "@/modules/organization/domain/invitation-errors.js";
import { InvitationRepository } from "@/modules/organization/domain/ports/repositories/invitation-repository.js";
import { type InvitationId } from "@/platform/ids/invitation-id.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";

export const InvitationRepositoryFake = Layer.effect(
  InvitationRepository,
  Effect.gen(function* () {
    const store = yield* Ref.make(HashMap.empty<InvitationId, Invitation>());

    const insertOne = (invitation: Invitation): Effect.Effect<void> =>
      Ref.update(store, HashMap.set(invitation.id, invitation));

    const updateOne = (invitation: Invitation): Effect.Effect<void, InvitationNotFound> =>
      Effect.flatMap(Ref.get(store), (m) =>
        HashMap.has(m, invitation.id)
          ? Ref.update(store, HashMap.set(invitation.id, invitation))
          : Effect.fail(new InvitationNotFound({ invitationId: invitation.id })),
      );

    const findOneById = (id: InvitationId): Effect.Effect<Invitation, InvitationNotFound> =>
      Effect.flatMap(Ref.get(store), (m) => {
        const found = HashMap.get(m, id);
        return found._tag === "Some"
          ? Effect.succeed(found.value)
          : Effect.fail(new InvitationNotFound({ invitationId: id }));
      });

    const findOneByToken = (token: string): Effect.Effect<Invitation, InvitationTokenNotFound> =>
      Effect.flatMap(Ref.get(store), (m) => {
        for (const inv of HashMap.values(m)) {
          if (inv.token === token) return Effect.succeed(inv);
        }
        return Effect.fail(new InvitationTokenNotFound());
      });

    // Newest-first, matching the live repo's `ORDER BY created_at DESC`.
    const byCreatedAtDesc = (a: Invitation, b: Invitation): number =>
      DateTime.toEpochMillis(b.createdAt) - DateTime.toEpochMillis(a.createdAt);

    const findManyByOrganizationId = (
      organizationId: OrganizationId,
    ): Effect.Effect<ReadonlyArray<Invitation>> =>
      Effect.map(Ref.get(store), (m) =>
        Array.from(HashMap.values(m))
          .filter((inv) => inv.organizationId === organizationId)
          .sort(byCreatedAtDesc),
      );

    const findOneOpenByOrganizationIdAndEmail = (
      organizationId: OrganizationId,
      inviteeEmail: string,
    ): Effect.Effect<Invitation | null> =>
      Effect.map(Ref.get(store), (m) => {
        const open = Array.from(HashMap.values(m))
          .filter(
            (inv) =>
              inv.organizationId === organizationId &&
              inv.inviteeEmail === inviteeEmail &&
              isOpen(inv),
          )
          .sort(byCreatedAtDesc);
        return open[0] ?? null;
      });

    return InvitationRepository.of({
      insertOne,
      updateOne,
      findOneById,
      findOneByToken,
      findManyByOrganizationId,
      findOneOpenByOrganizationIdAndEmail,
    });
  }),
);
