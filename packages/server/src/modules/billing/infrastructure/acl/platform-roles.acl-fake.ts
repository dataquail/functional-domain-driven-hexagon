import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { PlatformRoles } from "@/modules/billing/domain/ports/acl/platform-roles.acl.js";
import { type UserId } from "@/platform/ids/user-id.js";

// In-memory `PlatformRoles` for policy and use-case unit tests. Pass the set of
// super-admin user ids; everyone else is an ordinary caller.
export const makePlatformRolesFake = (superAdmins: ReadonlySet<UserId> = new Set()) =>
  Layer.succeed(
    PlatformRoles,
    PlatformRoles.of({
      isSuperAdmin: (userId) => Effect.succeed(superAdmins.has(userId)),
    }),
  );
