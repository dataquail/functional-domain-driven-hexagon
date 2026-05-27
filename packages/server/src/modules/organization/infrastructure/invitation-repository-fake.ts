import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

import { type Invitation } from "@/modules/organization/domain/invitation.aggregate.js";
import {
  InvitationNotFound,
  InvitationTokenNotFound,
} from "@/modules/organization/domain/invitation-errors.js";
import { InvitationRepository } from "@/modules/organization/domain/ports/repositories/invitation-repository.js";
import { type InvitationId } from "@/platform/ids/invitation-id.js";

export const InvitationRepositoryFake = Layer.effect(
  InvitationRepository,
  Effect.gen(function* () {
    const store = yield* Ref.make(HashMap.empty<InvitationId, Invitation>());

    const insert = (invitation: Invitation): Effect.Effect<void> =>
      Ref.update(store, HashMap.set(invitation.id, invitation));

    const update = (invitation: Invitation): Effect.Effect<void, InvitationNotFound> =>
      Effect.flatMap(Ref.get(store), (m) =>
        HashMap.has(m, invitation.id)
          ? Ref.update(store, HashMap.set(invitation.id, invitation))
          : Effect.fail(new InvitationNotFound({ invitationId: invitation.id })),
      );

    const findById = (id: InvitationId): Effect.Effect<Invitation, InvitationNotFound> =>
      Effect.flatMap(Ref.get(store), (m) => {
        const found = HashMap.get(m, id);
        return found._tag === "Some"
          ? Effect.succeed(found.value)
          : Effect.fail(new InvitationNotFound({ invitationId: id }));
      });

    const findByToken = (token: string): Effect.Effect<Invitation, InvitationTokenNotFound> =>
      Effect.flatMap(Ref.get(store), (m) => {
        for (const inv of HashMap.values(m)) {
          if (inv.token === token) return Effect.succeed(inv);
        }
        return Effect.fail(new InvitationTokenNotFound());
      });

    return InvitationRepository.of({ insert, update, findById, findByToken });
  }),
);
