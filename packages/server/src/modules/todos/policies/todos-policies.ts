import * as Check from "@/platform/auth/check.js";
import { SuperAdminOnly } from "@/platform/auth/policies/super-admin.js";
import type * as PolicyRegistry from "@/platform/auth/policy-registry.js";

import { IsTodoOrgMember } from "./is-todo-org-member.js";

// Two todo policy resources (see todo-resource-resolvers.ts):
//   - `todoCollection.read`        — list the todos in an org
//   - `todo.update` / `todo.delete` — act on a single todo
// All gate on org membership (super-admin bypasses). `create` is a flat
// action — the DSL forbids an id on Create, and a flat check can't see
// the orgId — so its endpoint runs `todoMemberCheck` directly against
// the path orgId, the same composed gate registered here.

declare module "@/platform/auth/policy-registry.js" {
  interface PolicyMap {
    todoCollection: {
      read: PolicyRegistry.CheckFor<"todoCollection", "read">;
    };
    todo: {
      update: PolicyRegistry.CheckFor<"todo", "update">;
      delete: PolicyRegistry.CheckFor<"todo", "delete">;
    };
  }
}

export const TodoCollectionResource = "todoCollection" as const;
export const TodoResource = "todo" as const;

// One composed gate reused across every todo operation, including the
// create endpoint's direct call — so the membership rule is defined once.
export const todoMemberCheck = Check.any(SuperAdminOnly, IsTodoOrgMember);

export const todosPolicies: PolicyRegistry.PolicyContribution = {
  todoCollection: {
    read: todoMemberCheck,
  },
  todo: {
    update: todoMemberCheck,
    delete: todoMemberCheck,
  },
};
