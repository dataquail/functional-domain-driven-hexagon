import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { UserId } from "@/globals/application/ddd/ids/user-id.ts";
import {
  UserProvisioning,
  UserProvisioningConflict,
} from "@/modules/auth/domain/ports/acl/user-provisioning.acl.ts";

// In-memory `UserProvisioning` for use-case unit tests (auth JIT sign-in) that
// don't want to stand up the user module's command bus + repository.
// `provision` mints a deterministic UserId; emails listed in `conflicts` fail
// the way the Live does when the user module reports an existing email, and
// `findByEmail` answers from `existing`.
export const makeUserProvisioningFake = (options?: {
  readonly conflicts?: ReadonlySet<string>;
  // Deterministic id assigned to the provisioned user. Defaults to a fixed
  // uuid so single-provision tests can assert against it.
  readonly userId?: UserId;
  readonly existing?: ReadonlyMap<string, UserId>;
}) => {
  const conflicts = options?.conflicts ?? new Set<string>();
  const existing = options?.existing ?? new Map<string, UserId>();
  const assignedId = options?.userId ?? UserId.make("99999999-9999-9999-9999-999999999999");

  return Layer.succeed(
    UserProvisioning,
    UserProvisioning.of({
      provision: (email) =>
        Effect.succeed(assignedId).pipe(
          Effect.filterOrFail(
            () => !conflicts.has(email) && !existing.has(email),
            () => new UserProvisioningConflict({ email }),
          ),
        ),
      findByEmail: (email) => Effect.succeed(Option.fromUndefinedOr(existing.get(email))),
    }),
  );
};
