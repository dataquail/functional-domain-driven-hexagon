import * as Effect from "effect/Effect";

import { PlatformRoles } from "@/modules/auth/domain/ports/acl/platform-roles.acl.js";
import { type FindCurrentUserPayload } from "@/modules/auth/queries/find-current-user.query.js";

// No SQL of its own: the caller's identity arrives on the query and the only
// other field belongs to the role module, reached through this module's port.
export const findCurrentUser = Effect.fn("findCurrentUser")(function* (
  query: FindCurrentUserPayload,
) {
  const roles = yield* PlatformRoles;
  const isSuperAdmin = yield* roles.isSuperAdmin(query.userId);
  return { userId: query.userId, isSuperAdmin };
});
