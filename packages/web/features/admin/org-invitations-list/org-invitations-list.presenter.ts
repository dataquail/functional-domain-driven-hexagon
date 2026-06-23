"use client";

import type { OrganizationId } from "@org/contracts/EntityIds";
import * as React from "react";

import {
  useOrgInvitationsSuspenseQuery,
  useResendOrgInvitationMutation,
  useRevokeOrgInvitationMutation,
} from "@/services/data-access/use-org-members-queries";

import {
  computeOrgInvitationsListView,
  type InvitationRowView,
} from "./org-invitations-list.view-model";

export const useOrgInvitationsListPresenter = (orgId: OrganizationId) => {
  const query = useOrgInvitationsSuspenseQuery(orgId);
  const resend = useResendOrgInvitationMutation();
  const revoke = useRevokeOrgInvitationMutation();

  const view = computeOrgInvitationsListView(query.data);

  const onResend = React.useCallback(
    (row: InvitationRowView) => {
      resend.mutate({ orgId, invitationId: row.invitationId });
    },
    [orgId, resend],
  );

  const onRevoke = React.useCallback(
    (row: InvitationRowView) => {
      revoke.mutate({ orgId, invitationId: row.invitationId });
    },
    [orgId, revoke],
  );

  return {
    ...view,
    onResend,
    onRevoke,
    isResending: resend.isPending,
    isRevoking: revoke.isPending,
  };
};
