import * as Effect from "effect/Effect";

import type * as PolicyRegistry from "@/platform/auth/policy-registry.js";
import { MembershipService } from "@/platform/ddd/ports/membership-service.js";

// Per-org "is this caller a member?" check. Consumes the platform-layer
// `MembershipService` ACL (never the org module's `MembershipRepository`
// directly) so the dep graph stays acyclic and the consuming-policy
// surface depends only on the generalized boolean shape.
//
// Typed via `PolicyRegistry.CheckFor<"organization", "update">` so the
// R channel resolves to the full `PolicyDeps` set — that lets
// `Authz.any(SuperAdminOnly, IsMember)` type-check uniformly even
// though the two halves use different deps (RoleService vs
// MembershipService). Same pattern as user-module's `IsSelf`.
//
// Composed via `Authz.any(SuperAdminOnly, IsMember)` so super-admins
// bypass the membership lookup entirely (short-circuit on the first
// `true`).
export const IsMember: PolicyRegistry.CheckFor<"organization", "update"> = (caller, organization) =>
  Effect.gen(function* () {
    const memberships = yield* MembershipService;
    return yield* memberships.isMember(caller.userId, organization.id);
  });
