"use client";

import { Button } from "@org/components/primitives/button";

import { useAcceptInvitationPresenter } from "./accept-invitation.presenter";

export const AcceptInvitation: React.FC<{ readonly token: string }> = ({ token }) => {
  const { isAccepting, onAccept } = useAcceptInvitationPresenter(token);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        You&apos;ve been invited to join an organization. Click below to accept.
      </p>
      <Button
        type="button"
        onClick={onAccept}
        disabled={isAccepting}
        className="w-full"
        data-testid="invitation-accept"
      >
        {isAccepting ? "Accepting…" : "Accept invitation"}
      </Button>
    </div>
  );
};
