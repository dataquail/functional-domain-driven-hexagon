"use client";

import type { OrganizationId } from "@org/contracts/EntityIds";
import * as React from "react";

import {
  useDemoteOrgMemberMutation,
  useOrgMembersSuspenseQuery,
  usePromoteOrgMemberMutation,
  useRemoveOrgMemberMutation,
} from "@/services/data-access/use-org-members-queries";

import { computeOrgMembersListView, type MemberRowView } from "./org-members-list.view-model";

export const useOrgMembersListPresenter = (orgId: OrganizationId) => {
  const query = useOrgMembersSuspenseQuery(orgId);
  const remove = useRemoveOrgMemberMutation();
  const promote = usePromoteOrgMemberMutation();
  const demote = useDemoteOrgMemberMutation();

  const view = computeOrgMembersListView(query.data);

  const onRemove = React.useCallback(
    (row: MemberRowView) => {
      remove.mutate({ orgId, userId: row.userId });
    },
    [orgId, remove],
  );

  const onPromote = React.useCallback(
    (row: MemberRowView) => {
      promote.mutate({ orgId, userId: row.userId });
    },
    [orgId, promote],
  );

  const onDemote = React.useCallback(
    (row: MemberRowView) => {
      demote.mutate({ orgId, userId: row.userId });
    },
    [orgId, demote],
  );

  return {
    ...view,
    onRemove,
    onPromote,
    onDemote,
    isRemoving: remove.isPending,
    // One in-flight role change at a time disables the role buttons so
    // a member can't be double-promoted/demoted mid-flight.
    isChangingRole: promote.isPending || demote.isPending,
  };
};
