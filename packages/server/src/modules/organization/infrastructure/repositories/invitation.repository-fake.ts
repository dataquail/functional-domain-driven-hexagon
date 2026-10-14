import * as Arr from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import type * as Option from "effect/Option";
import * as Ref from "effect/Ref";

import { type InvitationId } from "@/globals/application/ddd/ids/invitation-id.ts";
import { type Specification } from "@/globals/application/ddd/specification.ts";
import { InvitationNotFound } from "@/modules/organization/domain/invitation/invitation.errors.ts";
import { InvitationRepository } from "@/modules/organization/domain/invitation/invitation.repository.ts";
import { type InvitationRoot } from "@/modules/organization/domain/invitation/invitation.root.ts";

export const InvitationRepositoryFake = Layer.effect(
  InvitationRepository,
  Effect.gen(function* () {
    const store = yield* Ref.make(HashMap.empty<InvitationId, InvitationRoot>());

    const insertOne = (invitation: InvitationRoot): Effect.Effect<void> =>
      Ref.update(store, HashMap.set(invitation.id, invitation));

    const updateOne = (invitation: InvitationRoot): Effect.Effect<void, InvitationNotFound> =>
      Effect.flatMap(Ref.get(store), (m) => {
        if (!HashMap.has(m, invitation.id)) {
          return new InvitationNotFound({ invitationId: invitation.id });
        }

        return Ref.update(store, HashMap.set(invitation.id, invitation));
      });

    // Newest-first, matching the live repo's `ORDER BY created_at DESC`. The
    // spec IS the in-memory predicate — same object the live repo compiles to
    // SQL — so fake and live agree by construction.
    const byCreatedAtDesc = (a: InvitationRoot, b: InvitationRoot): number =>
      DateTime.toEpochMillis(b.createdAt) - DateTime.toEpochMillis(a.createdAt);

    const matching = (spec: Specification<InvitationRoot>) =>
      Effect.map(Ref.get(store), (m) =>
        Array.from(HashMap.values(m)).filter(spec).sort(byCreatedAtDesc),
      );

    const findOne = (
      spec: Specification<InvitationRoot>,
    ): Effect.Effect<Option.Option<InvitationRoot>> => Effect.map(matching(spec), Arr.head);

    const findMany = (
      spec: Specification<InvitationRoot>,
    ): Effect.Effect<ReadonlyArray<InvitationRoot>> => matching(spec);

    return InvitationRepository.of({ insertOne, updateOne, findOne, findMany });
  }),
);
