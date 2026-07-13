import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

import { InvitationNotFound } from "@/modules/organization/domain/invitation/invitation.errors.js";
import { InvitationRepository } from "@/modules/organization/domain/invitation/invitation.repository.js";
import { type InvitationRoot } from "@/modules/organization/domain/invitation/invitation.root.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";
import { type InvitationId } from "@/platform/ids/invitation-id.js";

export const InvitationRepositoryFake = Layer.effect(
  InvitationRepository,
  Effect.gen(function* () {
    const store = yield* Ref.make(HashMap.empty<InvitationId, InvitationRoot>());

    const insertOne = (invitation: InvitationRoot): Effect.Effect<void> =>
      Ref.update(store, HashMap.set(invitation.id, invitation));

    const updateOne = (invitation: InvitationRoot): Effect.Effect<void, InvitationNotFound> =>
      Effect.flatMap(Ref.get(store), (m) =>
        HashMap.has(m, invitation.id)
          ? Ref.update(store, HashMap.set(invitation.id, invitation))
          : Effect.fail(new InvitationNotFound({ invitationId: invitation.id })),
      );

    // Newest-first, matching the live repo's `ORDER BY created_at DESC`. The
    // spec IS the in-memory predicate — same object the live repo compiles to
    // SQL — so fake and live agree by construction.
    const byCreatedAtDesc = (a: InvitationRoot, b: InvitationRoot): number =>
      DateTime.toEpochMillis(b.createdAt) - DateTime.toEpochMillis(a.createdAt);

    const matching = (spec: Specification<InvitationRoot>) =>
      Effect.map(Ref.get(store), (m) =>
        Array.from(HashMap.values(m)).filter(spec).sort(byCreatedAtDesc),
      );

    const findOne = (spec: Specification<InvitationRoot>): Effect.Effect<InvitationRoot | null> =>
      Effect.map(matching(spec), (rows) => rows[0] ?? null);

    const findMany = (
      spec: Specification<InvitationRoot>,
    ): Effect.Effect<ReadonlyArray<InvitationRoot>> => matching(spec);

    return InvitationRepository.of({ insertOne, updateOne, findOne, findMany });
  }),
);
