import * as Schema from "effect/Schema";

import { UserId } from "@/platform/ids/user-id.js";

import { RoleValueObject } from "./role.value-object.js";

// Aggregate invariant: a user cannot be granted a role they already
// hold. Surfaces from `Roles.grant` and is translated to a 409-style
// conflict (or absorbed as idempotent) at the command boundary.
export class AlreadyHasRole extends Schema.TaggedErrorClass<AlreadyHasRole>("AlreadyHasRole")(
  "AlreadyHasRole",
  { userId: UserId, role: RoleValueObject },
) {}

// Aggregate invariant: a role can only be revoked if it is currently
// held. Surfaces from `Roles.revoke`.
export class DoesNotHaveRole extends Schema.TaggedErrorClass<DoesNotHaveRole>("DoesNotHaveRole")(
  "DoesNotHaveRole",
  { userId: UserId, role: RoleValueObject },
) {}

// Command-level domain invariant: the actor of a grant cannot be the
// target. Lives at the command boundary rather than on the aggregate
// because the aggregate doesn't carry actor context. The HTTP endpoint
// translates this to a 403 Forbidden.
export class CannotPromoteSelf extends Schema.TaggedErrorClass<CannotPromoteSelf>(
  "CannotPromoteSelf",
)("CannotPromoteSelf", { userId: UserId }) {}
