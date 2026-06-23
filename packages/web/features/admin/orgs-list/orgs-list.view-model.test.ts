import { OrganizationId } from "@org/contracts/EntityIds";
import { describe, expect, it } from "vitest";

import { computeOrgsListView } from "./orgs-list.view-model";

// Dates come through as ISO strings on the client — that's what the
// dehydrate → JSON → hydrate round-trip produces from `Schema.DateTimeUtc`.
// See the view-model's `formatDate` comment.
const makeOrg = (id: string, name: string, deletedAt: string | null = null) =>
  ({
    id: OrganizationId.make(id),
    name,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt,
  }) as unknown as never;

describe("computeOrgsListView", () => {
  it("maps rows and flags deletion state", () => {
    const view = computeOrgsListView({
      response: {
        organizations: [
          makeOrg("11111111-1111-1111-1111-111111111111", "Active Org"),
          makeOrg(
            "22222222-2222-2222-2222-222222222222",
            "Deleted Org",
            "2026-05-01T00:00:00.000Z",
          ),
        ],
        page: 1,
        pageSize: 10,
        total: 2,
      },
    });
    expect(view.rows).toHaveLength(2);
    expect(view.rows[0].isDeleted).toBe(false);
    expect(view.rows[1].isDeleted).toBe(true);
    expect(view.rows[1].deletedAtLabel).toBe("2026-05-01");
    expect(view.totalPages).toBe(1);
    expect(view.hasNext).toBe(false);
    expect(view.hasPrev).toBe(false);
  });

  it("paginates when there are more rows than pageSize", () => {
    const view = computeOrgsListView({
      response: {
        organizations: [makeOrg("11111111-1111-1111-1111-111111111111", "A")],
        page: 1,
        pageSize: 10,
        total: 25,
      },
    });
    expect(view.totalPages).toBe(3);
    expect(view.hasNext).toBe(true);
  });
});
