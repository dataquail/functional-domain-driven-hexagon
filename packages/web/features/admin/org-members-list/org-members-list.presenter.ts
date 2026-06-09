"use client";

import type { OrganizationId } from "@org/contracts/EntityIds";
import * as React from "react";

import {
  useAdminOrgMembersSuspenseQuery,
  useRemoveOrgMemberMutation,
} from "@/services/data-access/use-admin-org-members-queries";

import { computeOrgMembersListView, type MemberRowView } from "./org-members-list.view-model";

export const useOrgMembersListPresenter = (orgId: OrganizationId) => {
  const query = useAdminOrgMembersSuspenseQuery(orgId);
  const remove = useRemoveOrgMemberMutation();

  const view = computeOrgMembersListView(query.data);

  const onRemove = React.useCallback(
    (row: MemberRowView) => {
      remove.mutate({ orgId, userId: row.userId });
    },
    [orgId, remove],
  );

  return { ...view, onRemove, isRemoving: remove.isPending };
};
