// Invitation acceptance page. Lives inside (authed) so the auth guard
// catches an unauthenticated user and redirects through the BFF; on
// the way back, Next preserves the URL and the user lands here ready
// to accept.

import { Card } from "@org/components/primitives/card";
import React from "react";

import { AcceptInvitation } from "@/features/invite/accept-invitation/accept-invitation";

export default async function AcceptInvitationPage({
  params,
}: {
  readonly params: Promise<{ readonly token: string }>;
}) {
  const { token } = await params;

  return (
    <div className="mx-auto w-full max-w-md px-4">
      <Card className="shadow-md">
        <Card.Header>
          <Card.Title className="text-2xl font-semibold">You&apos;re invited</Card.Title>
        </Card.Header>
        <Card.Content>
          <AcceptInvitation token={token} />
        </Card.Content>
      </Card>
    </div>
  );
}
