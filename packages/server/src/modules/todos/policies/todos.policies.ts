import { Check, type CheckFor, type PolicyContribution } from "@effect-server-utils/authz";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { OrganizationAccess } from "@/modules/todos/domain/ports/acl/organization-access.acl.js";
import { PlatformRoles } from "@/modules/todos/domain/ports/acl/platform-roles.acl.js";
import { OrganizationAccessLive } from "@/modules/todos/infrastructure/acl/organization-access.acl-live.js";
import { PlatformRolesLive } from "@/modules/todos/infrastructure/acl/platform-roles.acl-live.js";

import { makeIsTodoOrgMember } from "./is-todo-org-member.policy.js";
import { makeIsTodoSuperAdmin } from "./is-todo-super-admin.policy.js";

// Two todo policy resources (see todo.resource-resolvers.ts), both scoped:
//   - `todoCollection` (by OrganizationId) — `create` a todo in an org and
//     `read` the org's list. Create carries the org id like every other
//     action, so the gate runs through the registry rather than beside it.
//   - `todo` (by the (orgId, todoId) pair) — `update` / `delete` one todo.
// All gate on org membership; super-admin bypasses.

declare module "@effect-server-utils/authz/policy-registry" {
  interface PolicyMap {
    todoCollection: {
      create: CheckFor<"todoCollection">;
      read: CheckFor<"todoCollection">;
    };
    todo: {
      update: CheckFor<"todo">;
      delete: CheckFor<"todo">;
    };
  }
}

export const TodoCollectionResource = "todoCollection" as const;
export const TodoResource = "todo" as const;

// The contribution is effectful because its checks close over this module's own
// ACL ports, which makes every registered check `R = never`. The composition
// root yields this Tag and hands the value to `makePolicyRegistry` — the same
// shape the resource resolvers already use.
export class TodoPolicyContribution extends Context.Service<
  TodoPolicyContribution,
  PolicyContribution
>()("TodoPolicyContribution") {}

export const TodoPoliciesLive = Layer.effect(
  TodoPolicyContribution,
  Effect.gen(function* () {
    const roles = yield* PlatformRoles;
    const organizations = yield* OrganizationAccess;

    // One composed gate reused across every todo operation, so the membership
    // rule is defined once.
    const todoMemberCheck = Check.any(
      makeIsTodoSuperAdmin(roles),
      makeIsTodoOrgMember(organizations),
    );

    return {
      todoCollection: {
        create: todoMemberCheck,
        read: todoMemberCheck,
      },
      todo: {
        update: todoMemberCheck,
        delete: todoMemberCheck,
      },
    };
  }),
).pipe(Layer.provide([PlatformRolesLive, OrganizationAccessLive]));
