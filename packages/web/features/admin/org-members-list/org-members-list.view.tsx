"use client";

import { Badge } from "@org/components/primitives/badge";
import { Button } from "@org/components/primitives/button";
import type { OrganizationId } from "@org/contracts/EntityIds";

import { useOrgMembersListPresenter } from "./org-members-list.presenter";

// Shared member roster. Rendered by the super-admin drill-in
// (/admin/orgs/[orgId]), the org-admin members page, and — read-only —
// the plain-member members page (/orgs/[orgId]/members). The roster
// endpoint is member-readable; the management actions (promote/demote/
// remove) are `update`-gated. `canManage` hides those controls for
// non-admins so a plain member sees the roster without dead buttons;
// the backend still 403s any mutation regardless.
export const OrgMembersList: React.FC<{
  readonly orgId: OrganizationId;
  readonly canManage?: boolean;
}> = ({ canManage = true, orgId }) => {
  const { isChangingRole, isEmpty, isRemoving, onDemote, onPromote, onRemove, rows } =
    useOrgMembersListPresenter(orgId);

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
          data-is-admin={row.isAdmin}
          className="flex items-center justify-between gap-3 rounded-md border bg-card p-3"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-medium text-foreground">{row.email}</p>
              {row.isAdmin ? (
                <Badge variant="default" data-testid="admin-org-members-admin-badge">
                  Admin
                </Badge>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">Joined {row.joinedAtLabel}</p>
          </div>
          {canManage ? (
            <div className="flex shrink-0 items-center gap-2">
              {row.isAdmin ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isChangingRole}
                  onClick={() => {
                    onDemote(row);
                  }}
                  data-testid="admin-org-members-demote"
                >
                  Demote
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isChangingRole}
                  onClick={() => {
                    onPromote(row);
                  }}
                  data-testid="admin-org-members-promote"
                >
                  Promote
                </Button>
              )}
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
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
};
