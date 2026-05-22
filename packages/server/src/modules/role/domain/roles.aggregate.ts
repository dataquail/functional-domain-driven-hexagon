import * as Either from "effect/Either";
import * as Schema from "effect/Schema";

import { UserId } from "@/platform/ids/user-id.js";

import { Role } from "./role.js";
import { AlreadyHasRole, DoesNotHaveRole } from "./role-errors.js";
import { type RoleEvent, RoleGranted, RoleRevoked } from "./role-events.js";

// The set of platform-wide roles assigned to one user. Aggregate root,
// identified by `userId` (every user has at most one Roles aggregate).
export class Roles extends Schema.Class<Roles>("Roles")({
  userId: UserId,
  // Modeled as an array at the schema layer for stable
  // (de)serialization, but treated as a set semantically: the
  // `grant`/`revoke` invariants below enforce uniqueness.
  roles: Schema.Array(Role),
}) {}

export type Result = {
  readonly roles: Roles;
  readonly events: ReadonlyArray<RoleEvent>;
};

// Factory for the "no roles yet" case — used by the command handler
// when `findByUserId` returns nothing and we still want to apply a
// grant rather than fail.
export const empty = (userId: UserId): Roles => Roles.make({ userId, roles: [] });

export const hasRole = (aggregate: Roles, role: Role): boolean => aggregate.roles.includes(role);

// Aggregate-protected invariant: a role can only be granted once.
// Returned as `Either` (sync) so the command handler can lift via
// `Effect.fromEither` — matches the Wallet aggregate's pattern.
export const grant = (aggregate: Roles, role: Role): Either.Either<Result, AlreadyHasRole> => {
  if (hasRole(aggregate, role)) {
    return Either.left(new AlreadyHasRole({ userId: aggregate.userId, role }));
  }
  return Either.right({
    roles: Roles.make({
      userId: aggregate.userId,
      roles: [...aggregate.roles, role],
    }),
    events: [RoleGranted.make({ userId: aggregate.userId, role })],
  });
};

// Aggregate-protected invariant: only roles currently held can be
// revoked.
export const revoke = (aggregate: Roles, role: Role): Either.Either<Result, DoesNotHaveRole> => {
  if (!hasRole(aggregate, role)) {
    return Either.left(new DoesNotHaveRole({ userId: aggregate.userId, role }));
  }
  return Either.right({
    roles: Roles.make({
      userId: aggregate.userId,
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- comparison is provably constant while `Role` has a single literal; becomes a real filter once a second role lands.
      roles: aggregate.roles.filter((r) => r !== role),
    }),
    events: [RoleRevoked.make({ userId: aggregate.userId, role })],
  });
};
