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
  demoteMemberActionAtom,
  isChangingRoleAtom,
  isRemovingAtom,
  orgMembersListAtom,
  orgMembersResultAtom,
  promoteMemberActionAtom,
  removeMemberActionAtom,
} from "./org-members-list.view-model";

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
  useAtomSuspense(orgMembersResultAtom(orgId));
  const { isEmpty, rows } = useAtomValue(orgMembersListAtom(orgId));
  const isChangingRole = useAtomValue(isChangingRoleAtom);
  const isRemoving = useAtomValue(isRemovingAtom);
  const remove = useAtomSet(removeMemberActionAtom);
  const promote = useAtomSet(promoteMemberActionAtom);
  const demote = useAtomSet(demoteMemberActionAtom);

  if (isEmpty) {
    return <EmptyState message="No members in this organization yet." />;
  }

  return (
    <List gap="sm" data-testid="admin-org-members">
      {rows.map((row) => (
        <List.Item key={row.userId}>
          <ListRow
            data-testid="admin-org-members-row"
            trailing={
              canManage ? (
                <Stack direction="row" gap="sm" align="center">
                  {row.isAdmin ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isChangingRole}
                      onClick={() => {
                        demote({ orgId, userId: row.userId });
                      }}
                      data-testid="admin-org-members-demote"
                    >
                      Demote
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isChangingRole}
                      onClick={() => {
                        promote({ orgId, userId: row.userId });
                      }}
                      data-testid="admin-org-members-promote"
                    >
                      Promote
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={isRemoving}
                    onClick={() => {
                      remove({ orgId, userId: row.userId });
                    }}
                    data-testid="admin-org-members-remove"
                  >
                    Remove
                  </Button>
                </Stack>
              ) : undefined
            }
          >
            <Stack direction="row" gap="sm" align="center">
              <Text weight="medium" truncate>
                {row.email}
              </Text>
              {row.isAdmin && (
                <Badge variant="default" data-testid="admin-org-members-admin-badge">
                  Admin
                </Badge>
              )}
            </Stack>
            <Text size="xs" tone="muted">
              Joined {row.joinedAtLabel}
            </Text>
          </ListRow>
        </List.Item>
      ))}
    </List>
  );
};
