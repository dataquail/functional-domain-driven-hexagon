"use client";

import { useAtomSet, useAtomSuspense, useAtomValue } from "@effect/atom-react";
import { EmptyState } from "@org/components/patterns/empty-state";
import { ListRow } from "@org/components/patterns/list-row";
import { Badge } from "@org/components/primitives/badge";
import { Button } from "@org/components/primitives/button";
import { List } from "@org/components/primitives/list";
import { Stack } from "@org/components/primitives/stack";
import { Text } from "@org/components/primitives/text";
import type { OrganizationId } from "@org/contracts/EntityIds";

import {
  isResendingAtom,
  isRevokingAtom,
  orgInvitationsListAtom,
  orgInvitationsResultAtom,
  resendInvitationActionAtom,
  revokeInvitationActionAtom,
} from "./org-invitations-list.view-model";

// Pending-invitations section of the member-management surface. Rendered
// below OrgMembersList on both the org-admin members page and the
// super-admin drill-in. Lists open invitations (pending + expired) with
// Resend and Revoke actions; the backing endpoints are `update`-gated,
// matching the members list.
export const OrgInvitationsList: React.FC<{ readonly orgId: OrganizationId }> = ({ orgId }) => {
  useAtomSuspense(orgInvitationsResultAtom(orgId));
  const { isEmpty, rows } = useAtomValue(orgInvitationsListAtom(orgId));
  const isResending = useAtomValue(isResendingAtom);
  const isRevoking = useAtomValue(isRevokingAtom);
  const resend = useAtomSet(resendInvitationActionAtom);
  const revoke = useAtomSet(revokeInvitationActionAtom);

  if (isEmpty) {
    return <EmptyState message="No pending invitations." />;
  }

  return (
    <List gap="sm" data-testid="org-invitations">
      {rows.map((row) => (
        <List.Item key={row.invitationId}>
          <ListRow
            data-testid="org-invitations-row"
            trailing={
              <Stack direction="row" gap="sm" align="center">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isResending}
                  onClick={() => {
                    resend({ orgId, invitationId: row.invitationId });
                  }}
                  data-testid="org-invitations-resend"
                >
                  Resend
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={isRevoking}
                  onClick={() => {
                    revoke({ orgId, invitationId: row.invitationId });
                  }}
                  data-testid="org-invitations-revoke"
                >
                  Revoke
                </Button>
              </Stack>
            }
          >
            <Stack direction="row" gap="sm" align="center">
              <Text weight="medium" truncate>
                {row.email}
              </Text>
              <Badge
                variant={row.isExpired ? "destructive" : "secondary"}
                data-testid="org-invitations-status"
              >
                {row.isExpired ? "Expired" : "Pending"}
              </Badge>
            </Stack>
            <Text size="xs" tone="muted">
              Expires {row.expiresAtLabel}
            </Text>
          </ListRow>
        </List.Item>
      ))}
    </List>
  );
};
