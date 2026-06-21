import * as Effect from "effect/Effect";

import * as OrganizationRoles from "@/modules/organization/domain/organization-roles.aggregate.js";
import { UsersLookup } from "@/modules/organization/domain/ports/external/users-lookup.js";
import { MembershipRepository } from "@/modules/organization/domain/ports/repositories/membership-repository.js";
import { OrganizationRolesRepository } from "@/modules/organization/domain/ports/repositories/organization-roles-repository.js";
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
    const rolesRepo = yield* OrganizationRolesRepository;
    const memberships = yield* repo.findByOrganizationId(query.organizationId);
    const users = yield* usersLookup.findByIds(memberships.map((m) => m.userId));
    // Preserve membership order (DB-sorted by createdAt). Skip any
    // user the lookup couldn't find (a hard inconsistency we don't
    // expect, but better to omit than to crash).
    const byId = new Map(users.map((u) => [u.userId, u]));
    // Per-member role lookup for the `isAdmin` flag. N+1 over the
    // roster, but member lists are small and bounded; if this ever
    // needs to scale, add a `findByOrganizationId` batch read to
    // `OrganizationRolesRepository`.
    const rows = yield* Effect.forEach(memberships, (m) =>
      Effect.gen(function* () {
        const user = byId.get(m.userId);
        if (user === undefined) return [];
        const roles = yield* rolesRepo.findByUserIdAndOrgId(m.userId, query.organizationId);
        return [
          {
            userId: m.userId,
            email: user.email,
            joinedAt: m.createdAt,
            isAdmin: OrganizationRoles.hasRole(roles, "admin"),
          },
        ];
      }),
    );
    return rows.flat();
  });
