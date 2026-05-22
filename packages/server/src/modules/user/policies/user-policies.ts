import * as Effect from "effect/Effect";

import { any } from "@/platform/auth/check.js";
import { SuperAdminOnly } from "@/platform/auth/policies/super-admin.js";
import type * as PolicyRegistry from "@/platform/auth/policy-registry.js";
import { type UserId } from "@/platform/ids/user-id.js";

import { type User } from "../domain/user.aggregate.js";

// Per-module declaration-merge contribution.
//
// `user.update` allows EITHER a super-admin OR the user themselves. The
// OR-composition is via `Check.any` (arrays are AND-composed; for OR
// you wrap with `any`). Today this covers two endpoints:
//   - promote-to-super-admin
//   - demote-from-super-admin
// Both call `Authz.hasPermissions(UserResource, Actions.Update, id)`.
//
// The policy says "can update this user." Whether a specific update
// makes business sense (e.g. should you be able to promote *yourself*
// to super-admin?) is a domain invariant, not an authz rule — that
// guard belongs in the relevant command/aggregate, not here.

declare module "@/platform/auth/resource-resolver-registry.js" {
  interface ResourceResolverMap {
    user: { resourceType: User; idType: UserId };
  }
}

declare module "@/platform/auth/policy-registry.js" {
  interface PolicyMap {
    user: {
      update: PolicyRegistry.CheckFor<"user", "update">;
    };
  }
}

// Resource constant exposed for endpoint call sites. Pair with the
// platform-wide `Actions` constants from `platform/auth/actions.ts`:
//   Authz.hasPermissions(UserResource, Actions.Update, request.path.id);
export const UserResource = "user" as const;

// The caller and the target are the same person. Used to allow
// self-service operations (notably self-demote — a super-admin who
// changes their mind should be able to drop the flag without first
// finding another super-admin).
const IsSelf: PolicyRegistry.CheckFor<"user", "update"> = (caller, user) =>
  Effect.succeed(caller.userId === user.id);

export const userPolicies: PolicyRegistry.PolicyContribution = {
  user: {
    update: any(SuperAdminOnly, IsSelf),
  },
};
