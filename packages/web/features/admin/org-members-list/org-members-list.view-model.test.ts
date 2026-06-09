import { OrganizationId, UserId } from "@org/contracts/EntityIds";
import { describe, expect, it } from "vitest";

import { computeOrgMembersListView } from "./org-members-list.view-model";

const orgId = OrganizationId.make("11111111-1111-1111-1111-111111111111");

describe("computeOrgMembersListView", () => {
  it("maps members and formats joinedAt", () => {
    const view = computeOrgMembersListView({
      members: [
        {
          userId: UserId.make("22222222-2222-2222-2222-222222222222"),
          email: "a@example.com",
          joinedAt: "2026-05-01T00:00:00.000Z",
        },
      ],
    } as unknown as never);
    expect(view.rows).toHaveLength(1);
    expect(view.rows[0]?.joinedAtLabel).toBe("2026-05-01");
    expect(view.isEmpty).toBe(false);
    void orgId;
  });

  it("isEmpty when there are no members", () => {
    const view = computeOrgMembersListView({ members: [] });
    expect(view.isEmpty).toBe(true);
  });
});
