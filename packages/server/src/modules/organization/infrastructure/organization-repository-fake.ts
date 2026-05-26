import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

import { type Organization } from "@/modules/organization/domain/organization.aggregate.js";
import { OrganizationNotFound } from "@/modules/organization/domain/organization-errors.js";
import { OrganizationRepository } from "@/modules/organization/domain/ports/repositories/organization-repository.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";

export const OrganizationRepositoryFake = Layer.effect(
  OrganizationRepository,
  Effect.gen(function* () {
    const store = yield* Ref.make(HashMap.empty<OrganizationId, Organization>());

    const insert = (organization: Organization): Effect.Effect<void> =>
      Ref.update(store, HashMap.set(organization.id, organization));

    const update = (organization: Organization): Effect.Effect<void, OrganizationNotFound> =>
      Effect.flatMap(Ref.get(store), (m) =>
        HashMap.has(m, organization.id)
          ? Ref.update(store, HashMap.set(organization.id, organization))
          : Effect.fail(new OrganizationNotFound({ organizationId: organization.id })),
      );

    const findById = (id: OrganizationId): Effect.Effect<Organization, OrganizationNotFound> =>
      Effect.flatMap(Ref.get(store), (m) => {
        const found = HashMap.get(m, id);
        if (found._tag === "None" || found.value.deletedAt !== null) {
          return Effect.fail(new OrganizationNotFound({ organizationId: id }));
        }
        return Effect.succeed(found.value);
      });

    const findByIdIncludingDeleted = (
      id: OrganizationId,
    ): Effect.Effect<Organization, OrganizationNotFound> =>
      Effect.flatMap(Ref.get(store), (m) => {
        const found = HashMap.get(m, id);
        return found._tag === "Some"
          ? Effect.succeed(found.value)
          : Effect.fail(new OrganizationNotFound({ organizationId: id }));
      });

    return OrganizationRepository.of({ insert, update, findById, findByIdIncludingDeleted });
  }),
);
