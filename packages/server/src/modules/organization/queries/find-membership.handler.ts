import * as Effect from "effect/Effect";

import { MembershipRepository } from "@/modules/organization/domain/membership/membership.repository.js";
import { type FindMembershipQuery } from "@/modules/organization/queries/find-membership.query.js";

// Goes through the repository so the org module stays the single source
// of truth for membership. Absence (`MembershipNotFound`) is the normal
// "not a member" answer, mapped to `false` — not an error.
export const findMembership = Effect.fn("findMembership")(function* (query: FindMembershipQuery) {
  const repo = yield* MembershipRepository;
  return yield* repo.findOneByUserIdAndOrgId(query.userId, query.organizationId).pipe(
    Effect.map(() => ({ isMember: true })),
    Effect.catchTag("MembershipNotFound", () => Effect.succeed({ isMember: false })),
  );
});
