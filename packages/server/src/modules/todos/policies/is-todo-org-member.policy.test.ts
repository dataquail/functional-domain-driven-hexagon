import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";

import { makeIsTodoOrgMember } from "@/modules/todos/policies/is-todo-org-member.policy.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const orgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const caller = { sessionId: "s", userId };
const resource = { organizationId: orgId };

// The check closes over its port, so there is nothing to provide — no layers,
// and no unrelated ACLs to satisfy an R channel the check never uses.
const organizationAccess = (isMember: boolean) => ({
  isMember: () => Effect.succeed(isMember),
});

describe("makeIsTodoOrgMember", () => {
  it.effect("returns true when the organization reports the caller is a member", () =>
    Effect.map(makeIsTodoOrgMember(organizationAccess(true))(caller, resource), (result) => {
      deepStrictEqual(result, true);
    }),
  );

  it.effect("returns false when the caller is not a member of the todo's org", () =>
    Effect.map(makeIsTodoOrgMember(organizationAccess(false))(caller, resource), (result) => {
      deepStrictEqual(result, false);
    }),
  );

  it.effect("asks about the caller and the resource's org", () => {
    const seen: Array<{ userId: UserId; organizationId: OrganizationId }> = [];
    return Effect.map(
      makeIsTodoOrgMember({
        isMember: (askedUser, askedOrg) => {
          seen.push({ userId: askedUser, organizationId: askedOrg });
          return Effect.succeed(true);
        },
      })(caller, resource),
      () => {
        deepStrictEqual(seen, [{ userId, organizationId: orgId }]);
      },
    );
  });
});
