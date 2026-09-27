import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { type UserId } from "@/globals/application/ddd/ids/user-id.js";
import { PlatformRoles } from "@/modules/organization/domain/ports/acl/platform-roles.acl.js";

// In-memory `PlatformRoles` for policy and use-case unit tests. Pass the set of
// super-admin user ids; everyone else is an ordinary caller.
export const makePlatformRolesFake = (superAdmins: ReadonlySet<UserId> = new Set()) =>
  Layer.succeed(
    PlatformRoles,
    PlatformRoles.of({
      isSuperAdmin: (userId) => Effect.succeed(superAdmins.has(userId)),
    }),
  );
