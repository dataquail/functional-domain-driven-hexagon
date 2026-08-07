import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  UserProvisioning,
  UserProvisioningConflict,
} from "@/modules/auth/domain/ports/acl/user-provisioning.acl.js";
import { UserId } from "@/platform/ids/user-id.js";

// In-memory `UserProvisioning` for use-case unit tests (auth JIT sign-in) that
// don't want to stand up the user module's command bus + repository.
// `provision` mints a deterministic UserId; emails listed in `conflicts` fail
// the way the Live does when the user module reports an existing email.
export const makeUserProvisioningFake = (options?: {
  readonly conflicts?: ReadonlySet<string>;
  // Deterministic id assigned to the provisioned user. Defaults to a fixed
  // uuid so single-provision tests can assert against it.
  readonly userId?: UserId;
}) => {
  const conflicts = options?.conflicts ?? new Set<string>();
  const assignedId = options?.userId ?? UserId.make("99999999-9999-9999-9999-999999999999");

  return Layer.succeed(
    UserProvisioning,
    UserProvisioning.of({
      provision: (email) =>
        conflicts.has(email) ? new UserProvisioningConflict({ email }) : Effect.succeed(assignedId),
    }),
  );
};
