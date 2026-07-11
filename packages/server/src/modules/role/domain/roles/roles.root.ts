import * as Schema from "effect/Schema";

import { UserId } from "@/platform/ids/user-id.js";

import { RoleValueObject } from "./role.value-object.js";

// The set of platform-wide roles assigned to one user. Aggregate root,
// identified by `userId` (every user has at most one Roles aggregate).
// A dumb value (ADR-0003); operations live in `roles.root-ops.ts`
// (`RolesRootOps`) and predicates in `roles.specification.ts`
// (`RolesSpecifications`).
export class RolesRoot extends Schema.Class<RolesRoot>("RolesRoot")({
  userId: UserId,
  // Modeled as an array at the schema layer for stable
  // (de)serialization, but treated as a set semantically: the
  // `grant`/`revoke` invariants enforce uniqueness.
  roles: Schema.Array(RoleValueObject),
}) {}
