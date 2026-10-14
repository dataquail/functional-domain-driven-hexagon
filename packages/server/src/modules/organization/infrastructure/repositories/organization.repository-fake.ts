import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import type * as Option from "effect/Option";
import * as Ref from "effect/Ref";

import { type OrganizationId } from "@/globals/application/ddd/ids/organization-id.ts";
import { type Specification } from "@/globals/application/ddd/specification.ts";
import { OrganizationNotFound } from "@/modules/organization/domain/organization/organization.errors.ts";
import { OrganizationRepository } from "@/modules/organization/domain/organization/organization.repository.ts";
import { type OrganizationRoot } from "@/modules/organization/domain/organization/organization.root.ts";

export const OrganizationRepositoryFake = Layer.effect(
  OrganizationRepository,
  Effect.gen(function* () {
    const store = yield* Ref.make(HashMap.empty<OrganizationId, OrganizationRoot>());

    const insertOne = (organization: OrganizationRoot): Effect.Effect<void> =>
      Ref.update(store, HashMap.set(organization.id, organization));

    const updateOne = (organization: OrganizationRoot): Effect.Effect<void, OrganizationNotFound> =>
      Effect.flatMap(Ref.get(store), (m) => {
        if (!HashMap.has(m, organization.id)) {
          return new OrganizationNotFound({ organizationId: organization.id });
        }

        return Ref.update(store, HashMap.set(organization.id, organization));
      });

    // The spec IS the in-memory predicate — the same object the live repo
    // compiles to SQL — so fake and live agree by construction.
    const findOne = (
      spec: Specification<OrganizationRoot>,
    ): Effect.Effect<Option.Option<OrganizationRoot>> =>
      Effect.map(Ref.get(store), (m) => Arr.findFirst(HashMap.values(m), spec));

    return OrganizationRepository.of({
      insertOne,
      updateOne,
      findOne,
    });
  }),
);
