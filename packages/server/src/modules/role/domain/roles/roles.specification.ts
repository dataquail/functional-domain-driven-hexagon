import {
  type Predicate,
  Spec,
  type Specification,
} from "@/platform/ddd/contracts/specification.js";
import { type UserId } from "@/platform/ids/user-id.js";

import { type RoleValueObject } from "./role.value-object.js";
import { type RolesRoot } from "./roles.root.js";

// Translatable identity spec — `userId` lives on every row of the aggregate, so
// this compiles to a WHERE that the repository uses to fetch the row set it
// reconstitutes into one aggregate.
const forUser = (userId: UserId): Specification<RolesRoot> =>
  Spec.eq<RolesRoot, "userId">("userId", userId);

// Eval-only: `hasRole` reaches into the `roles` child collection, which the
// Criteria DSL cannot express (there is no "some child row" node). It is a
// Predicate, never a Specification, so it guards aggregate ops but can never be
// handed to a repository — the spec test locks that boundary at compile time.
const hasRole =
  (role: RoleValueObject): Predicate<RolesRoot> =>
  (aggregate) =>
    aggregate.roles.includes(role);

export const RolesSpecifications = { forUser, hasRole } as const;
