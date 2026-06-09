"use client";

import { Button } from "@org/components/primitives/button";
import type { OrganizationId } from "@org/contracts/EntityIds";

import { useOrgMembersListPresenter } from "./org-members-list.presenter";

export const OrgMembersList: React.FC<{ readonly orgId: OrganizationId }> = ({ orgId }) => {
  const { isEmpty, isRemoving, onRemove, rows } = useOrgMembersListPresenter(orgId);

  if (isEmpty) {
    return (
      <div className="rounded-lg bg-muted/50 py-6 text-center">
        <p className="text-sm text-muted-foreground">No members in this organization yet.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2" data-testid="admin-org-members">
      {rows.map((row) => (
        <li
          key={row.userId}
          data-testid="admin-org-members-row"
          data-user-id={row.userId}
          className="flex items-center justify-between gap-3 rounded-md border bg-card p-3"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-foreground">{row.email}</p>
            <p className="text-xs text-muted-foreground">Joined {row.joinedAtLabel}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={isRemoving}
            onClick={() => {
              onRemove(row);
            }}
            data-testid="admin-org-members-remove"
          >
            Remove
          </Button>
        </li>
      ))}
    </ul>
  );
};
