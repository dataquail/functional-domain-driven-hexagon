import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

import { type OrganizationId } from "@/globals/application/ddd/ids/organization-id.js";
import { type Specification } from "@/globals/application/ddd/specification.js";
import { OrganizationNotFound } from "@/modules/organization/domain/organization/organization.errors.js";
import { OrganizationRepository } from "@/modules/organization/domain/organization/organization.repository.js";
import { type OrganizationRoot } from "@/modules/organization/domain/organization/organization.root.js";

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
          : new OrganizationNotFound({ organizationId: organization.id }),
      );

    // The spec IS the in-memory predicate — the same object the live repo
    // compiles to SQL — so fake and live agree by construction.
    const findOne = (
      spec: Specification<OrganizationRoot>,
    ): Effect.Effect<OrganizationRoot | null> =>
      Effect.map(Ref.get(store), (m) => Array.from(HashMap.values(m)).find(spec) ?? null);

    return OrganizationRepository.of({
      insertOne,
      updateOne,
      findOne,
    });
  }),
);
