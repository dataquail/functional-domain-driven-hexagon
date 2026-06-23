"use client";

// Presenter for AcceptInvitation. Wraps the accept mutation and on
// success routes the user into the org they just joined. The 410 Gone
// errors (accepted / revoked / expired) come back as
// `InvitationGoneError` with a `reason` field; we surface them via
// the mutation hook's toast mapping and leave the page in place so
// the user can read the message.

import { useRouter } from "next/navigation";
import * as React from "react";

import { useAcceptInvitationMutation } from "@/services/data-access/use-orgs-queries";

export const useAcceptInvitationPresenter = (token: string) => {
  const router = useRouter();
  const acceptMutation = useAcceptInvitationMutation();

  const onAccept = React.useCallback(async () => {
    try {
      const result = await acceptMutation.mutateAsync({ token });
      router.push(`/orgs/${result.organizationId}`);
    } catch {
      // Surfaced via toast.
    }
  }, [acceptMutation, router, token]);

  return { onAccept, isAccepting: acceptMutation.isPending };
};
