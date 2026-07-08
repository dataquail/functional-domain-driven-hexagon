import * as Effect from "effect/Effect";

import { RolesRepository } from "@/modules/role/domain/ports/repositories/roles.repository.js";
import { type FindUserRolesQuery } from "@/modules/role/queries/find-user-roles.query.js";

// Goes through the repository (rather than reading SQL directly) so the
// Roles aggregate's mapping logic is the single source of truth for
// "what counts as a recognized role." If we ever cache, the cache lives
// at this handler.
export const findUserRoles = Effect.fn("findUserRoles")(function* (query: FindUserRolesQuery) {
  const repo = yield* RolesRepository;
  const aggregate = yield* repo.findOneByUserId(query.userId);
  return { userId: aggregate.userId, roles: aggregate.roles };
});
