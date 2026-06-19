import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  UserProvisioning,
  UserProvisioningConflict,
} from "@/platform/ddd/ports/user-provisioning.js";
import { UserId } from "@/platform/ids/user-id.js";

// In-memory `UserProvisioning` for unit tests (e.g. auth JIT sign-in) that
// don't want to wire the user module's command bus + repository. `provision`
// mints a deterministic UserId per email and records the call. Emails listed
// in `conflicts` fail with `UserProvisioningConflict`, mirroring the Live's
// mapping of the user module's `UserAlreadyExists`.
export type UserProvisioningFakeState = {
  readonly provisioned: ReadonlyArray<{ readonly email: string; readonly userId: UserId }>;
};

export const makeUserProvisioningFake = (options?: {
  readonly conflicts?: ReadonlySet<string>;
  // Deterministic id assigned to the next provisioned user. Defaults to a
  // fixed uuid so single-provision tests can assert against it.
  readonly userId?: UserId;
}) => {
  const conflicts = options?.conflicts ?? new Set<string>();
  const assignedId = options?.userId ?? UserId.make("99999999-9999-9999-9999-999999999999");

  return Layer.succeed(
    UserProvisioning,
    UserProvisioning.of({
      provision: (email) =>
        conflicts.has(email)
          ? Effect.fail(new UserProvisioningConflict({ email }))
          : Effect.succeed(assignedId),
    }),
  );
};

export const UserProvisioningFake = makeUserProvisioningFake();
