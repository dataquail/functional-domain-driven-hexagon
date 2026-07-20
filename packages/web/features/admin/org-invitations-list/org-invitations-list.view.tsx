"use client";

import { Badge } from "@org/components/primitives/badge";
import { Button } from "@org/components/primitives/button";
import type { OrganizationId } from "@org/contracts/EntityIds";

import { useOrgInvitationsListPresenter } from "./org-invitations-list.presenter";

// Pending-invitations section of the member-management surface. Rendered
// below OrgMembersList on both the org-admin members page and the
// super-admin drill-in. Lists open invitations (pending + expired) with
// Resend and Revoke actions; the backing endpoints are `update`-gated,
// matching the members list.
export const OrgInvitationsList: React.FC<{ readonly orgId: OrganizationId }> = ({ orgId }) => {
  const { isEmpty, isResending, isRevoking, onResend, onRevoke, rows } =
    useOrgInvitationsListPresenter(orgId);

  if (isEmpty) {
    return (
      <div className="rounded-lg bg-muted/50 py-6 text-center">
        <p className="text-sm text-muted-foreground">No pending invitations.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2" data-testid="org-invitations">
      {rows.map((row) => (
        <li
          key={row.invitationId}
          data-testid="org-invitations-row"
          data-invitation-id={row.invitationId}
          data-expired={row.isExpired}
          className="flex items-center justify-between gap-3 rounded-md border bg-card p-3"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-medium text-foreground">{row.email}</p>
              <Badge
                variant={row.isExpired ? "destructive" : "secondary"}
                data-testid="org-invitations-status"
              >
                {row.isExpired ? "Expired" : "Pending"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Expires {row.expiresAtLabel}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isResending}
              onClick={() => {
                onResend(row);
              }}
              data-testid="org-invitations-resend"
            >
              Resend
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={isRevoking}
              onClick={() => {
                onRevoke(row);
              }}
              data-testid="org-invitations-revoke"
            >
              Revoke
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
};
