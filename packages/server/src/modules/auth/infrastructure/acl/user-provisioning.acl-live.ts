import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  UserProvisioning,
  UserProvisioningConflict,
} from "@/modules/auth/domain/ports/acl/user-provisioning.acl.js";
import { UserCommands } from "@/modules/user/index.js";

// ADR-0022 outbound adapter. The one place in the auth module where the user
// module's barrel is imported — sign-in depends on `UserProvisioning` instead.
//
// It resolves the user module's own dispatch surface rather than the whole command
// bus. Naming the bus would be a cycle: the bus aggregates every module's dispatch
// surface, including auth's, whose handlers need this port. Naming just the module
// this adapter actually talks to leaves the real graph, which is acyclic.
export const UserProvisioningLive = Layer.effect(
  UserProvisioning,
  Effect.gen(function* () {
    const userCommands = yield* UserCommands;
    return UserProvisioning.of({
      provision: (email) =>
        userCommands.CreateUserCommand({ email }).pipe(
          Effect.catchTag("UserAlreadyExists", () => new UserProvisioningConflict({ email })),
          Effect.withSpan("UserProvisioning.provision"),
        ),
    });
  }),
);
