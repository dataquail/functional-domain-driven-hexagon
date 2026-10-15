import * as Result from "effect/Result";

import { type UserId } from "@/globals/application/ddd/ids/user-id";

import { AlreadyHasRole, DoesNotHaveRole } from "./role.errors";
import { type RoleEvent, RoleGranted, RoleRevoked } from "./role.events";
import { type RoleValueObject } from "./role.value-object";
import { RolesRoot } from "./roles.root";
import { RolesSpecifications } from "./roles.specification";

export type Outcome = {
  readonly roles: RolesRoot;
  readonly events: ReadonlyArray<RoleEvent>;
};

// Factory for the "no roles yet" case — used by the command handler
// when `findOne` returns nothing and we still want to apply a
// grant rather than fail.
const empty = (userId: UserId): RolesRoot => RolesRoot.make({ userId, roles: [] });

// Aggregate-protected invariant: a role can only be granted once.
// Returned as `Result` (sync) so the command handler can lift via
// `Effect.fromResult` — matches the WalletRoot aggregate's pattern.
const grant = (
  aggregate: RolesRoot,
  role: RoleValueObject,
): Result.Result<Outcome, AlreadyHasRole> => {
  if (RolesSpecifications.hasRole(role)(aggregate)) {
    return Result.fail(new AlreadyHasRole({ userId: aggregate.userId, role }));
  }

  return Result.succeed({
    roles: RolesRoot.make({
      userId: aggregate.userId,
      roles: [...aggregate.roles, role],
    }),
    events: [RoleGranted.make({ userId: aggregate.userId, role })],
  });
};

// Aggregate-protected invariant: only roles currently held can be
// revoked.
const revoke = (
  aggregate: RolesRoot,
  role: RoleValueObject,
): Result.Result<Outcome, DoesNotHaveRole> => {
  if (!RolesSpecifications.hasRole(role)(aggregate)) {
    return Result.fail(new DoesNotHaveRole({ userId: aggregate.userId, role }));
  }

  return Result.succeed({
    roles: RolesRoot.make({
      userId: aggregate.userId,
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- comparison is provably constant while `RoleValueObject` has a single literal; becomes a real filter once a second role lands.
      roles: aggregate.roles.filter((r) => r !== role),
    }),
    events: [RoleRevoked.make({ userId: aggregate.userId, role })],
  });
};

export const RolesRootOps = { empty, grant, revoke } as const;
