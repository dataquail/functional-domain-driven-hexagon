import * as Effect from "effect/Effect";

import { UsersLookup } from "@/modules/organization/domain/ports/external/users-lookup.js";
import { MembershipRepository } from "@/modules/organization/domain/ports/repositories/membership-repository.js";
import {
  type FindOrganizationMembershipsOutput,
  type FindOrganizationMembershipsQuery,
} from "@/modules/organization/queries/find-organization-memberships-query.js";

export const findOrganizationMemberships = (
  query: FindOrganizationMembershipsQuery,
): FindOrganizationMembershipsOutput =>
  Effect.gen(function* () {
    const repo = yield* MembershipRepository;
    const usersLookup = yield* UsersLookup;
    const memberships = yield* repo.findByOrganizationId(query.organizationId);
    const users = yield* usersLookup.findByIds(memberships.map((m) => m.userId));
    // Preserve membership order (DB-sorted by createdAt). Skip any
    // user the lookup couldn't find (a hard inconsistency we don't
    // expect, but better to omit than to crash).
    const byId = new Map(users.map((u) => [u.userId, u]));
    return memberships.flatMap((m) => {
      const user = byId.get(m.userId);
      return user === undefined
        ? []
        : [{ userId: m.userId, email: user.email, joinedAt: m.createdAt }];
    });
  });
