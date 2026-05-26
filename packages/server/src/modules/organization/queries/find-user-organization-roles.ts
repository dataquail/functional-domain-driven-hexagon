import * as Effect from "effect/Effect";

import { OrganizationRolesRepository } from "@/modules/organization/domain/organization-roles-repository.js";
import {
  type FindUserOrganizationRolesOutput,
  type FindUserOrganizationRolesQuery,
} from "@/modules/organization/queries/find-user-organization-roles-query.js";

// Goes through the repository (rather than reading SQL directly) so the
// `OrganizationRoles` aggregate's mapping logic is the single source of
// truth for "what counts as a recognized role." Same shape as
// `findUserRoles` in the role module.
export const findUserOrganizationRoles = (
  query: FindUserOrganizationRolesQuery,
): FindUserOrganizationRolesOutput =>
  Effect.gen(function* () {
    const repo = yield* OrganizationRolesRepository;
    const aggregate = yield* repo.findByUserIdAndOrgId(query.userId, query.organizationId);
    return {
      userId: aggregate.userId,
      organizationId: aggregate.organizationId,
      roles: aggregate.roles.map((r) => r.role),
    };
  });
