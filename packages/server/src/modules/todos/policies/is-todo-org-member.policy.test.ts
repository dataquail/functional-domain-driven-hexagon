// Side-effect imports: these modules carry the `declare module`
// augmentations that register the `todoCollection` / `todo` resources in
// `PolicyMap` / `ResourceResolverMap`, which `ResourceCheck<TodoOrgContext>`
// composes against.
import "@/modules/todos/policies/todos.policies.js";
import "@/modules/todos/policies/todo.resource-resolvers.js";

import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { IsTodoOrgMember } from "@/modules/todos/policies/is-todo-org-member.policy.js";
import { MembershipService } from "@/platform/ddd/ports/membership-service.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import { makeOrganizationRoleServiceFake } from "@/test-utils/organization-role-service-fake.js";
import { makeRoleServiceFake } from "@/test-utils/role-service-fake.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const orgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const caller = { sessionId: "s", userId };
const resource = { organizationId: orgId };

// `IsTodoOrgMember` only reads `MembershipService`, but its registry
// type (`CheckFor`) declares the full `PolicyDeps` set in R, so the
// other two ACLs are provided as empty fakes to satisfy the channel.
const membershipFake = (isMember: boolean) =>
  Layer.succeed(
    MembershipService,
    MembershipService.of({ isMember: () => Effect.succeed(isMember) }),
  );

const PolicyDepsFake = (isMember: boolean) =>
  Layer.mergeAll(
    membershipFake(isMember),
    makeRoleServiceFake(new Map()),
    makeOrganizationRoleServiceFake(),
  );

describe("IsTodoOrgMember", () => {
  it.effect("returns true when MembershipService reports the caller is a member", () =>
    IsTodoOrgMember(caller, resource).pipe(
      Effect.tap((result) =>
        Effect.sync(() => {
          deepStrictEqual(result, true);
        }),
      ),
      Effect.provide(PolicyDepsFake(true)),
    ),
  );

  it.effect("returns false when the caller is not a member of the todo's org", () =>
    IsTodoOrgMember(caller, resource).pipe(
      Effect.tap((result) =>
        Effect.sync(() => {
          deepStrictEqual(result, false);
        }),
      ),
      Effect.provide(PolicyDepsFake(false)),
    ),
  );
});
