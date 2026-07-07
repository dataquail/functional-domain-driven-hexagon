import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

import { OrganizationNotFound } from "@/modules/organization/domain/organization.errors.js";
import { type OrganizationRoot } from "@/modules/organization/domain/organization.root.js";
import { OrganizationRepository } from "@/modules/organization/domain/ports/repositories/organization.repository.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";

export const OrganizationRepositoryFake = Layer.effect(
  OrganizationRepository,
  Effect.gen(function* () {
    const store = yield* Ref.make(HashMap.empty<OrganizationId, OrganizationRoot>());

    const insertOne = (organization: OrganizationRoot): Effect.Effect<void> =>
      Ref.update(store, HashMap.set(organization.id, organization));

    const updateOne = (organization: OrganizationRoot): Effect.Effect<void, OrganizationNotFound> =>
      Effect.flatMap(Ref.get(store), (m) =>
        HashMap.has(m, organization.id)
          ? Ref.update(store, HashMap.set(organization.id, organization))
          : Effect.fail(new OrganizationNotFound({ organizationId: organization.id })),
      );

    const findOneById = (
      id: OrganizationId,
    ): Effect.Effect<OrganizationRoot, OrganizationNotFound> =>
      Effect.flatMap(Ref.get(store), (m) => {
        const found = HashMap.get(m, id);
        if (found._tag === "None" || found.value.deletedAt !== null) {
          return Effect.fail(new OrganizationNotFound({ organizationId: id }));
        }
        return Effect.succeed(found.value);
      });

    const findOneByIdIncludingDeleted = (
      id: OrganizationId,
    ): Effect.Effect<OrganizationRoot, OrganizationNotFound> =>
      Effect.flatMap(Ref.get(store), (m) => {
        const found = HashMap.get(m, id);
        return found._tag === "Some"
          ? Effect.succeed(found.value)
          : Effect.fail(new OrganizationNotFound({ organizationId: id }));
      });

    return OrganizationRepository.of({
      insertOne,
      updateOne,
      findOneById,
      findOneByIdIncludingDeleted,
    });
  }),
);
