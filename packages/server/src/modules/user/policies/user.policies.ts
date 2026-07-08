import * as Effect from "effect/Effect";

import { any } from "@/platform/auth/check.js";
import { SuperAdminOnly } from "@/platform/auth/policies/super-admin.js";
import type * as PolicyRegistry from "@/platform/auth/policy-registry.js";
import { type UserId } from "@/platform/ids/user-id.js";

import { type UserRoot } from "../domain/user.root.js";

// Per-module declaration-merge contribution.
//
// `user.update` allows EITHER a super-admin OR the user themselves.
// The OR-composition is via `Check.any` (arrays are AND-composed; for
// OR you wrap with `any`). The policy says "can update this user."
// Whether a specific update makes business sense is a domain
// invariant, not an authz rule — that guard belongs in the relevant
// command/aggregate, not here.

declare module "@/platform/auth/resource-resolver-registry.js" {
  interface ResourceResolverMap {
    user: { resourceType: UserRoot; idType: UserId };
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
//   Authz.hasPermissions(UserResource, Actions.Update, request.params.id);
export const UserResource = "user" as const;

// The caller and the target are the same person. Used to allow
// self-service operations on a user resource.
const IsSelf: PolicyRegistry.CheckFor<"user", "update"> = (caller, user) =>
  Effect.succeed(caller.userId === user.id);

export const userPolicies: PolicyRegistry.PolicyContribution = {
  user: {
    update: any(SuperAdminOnly, IsSelf),
  },
};
