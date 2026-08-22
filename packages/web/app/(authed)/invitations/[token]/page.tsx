// Invitation acceptance page. Lives inside (authed) so the auth guard
// catches an unauthenticated user and redirects through the BFF; on
// the way back, Next preserves the URL and the user lands here ready
// to accept.

import { CardSection } from "@org/components/patterns/card-section";
import { PageShell } from "@org/components/patterns/page-shell";
import React from "react";

import { AcceptInvitation } from "@/features/invite/accept-invitation/accept-invitation.view";

export default async function AcceptInvitationPage({
  params,
}: {
  readonly params: Promise<{ readonly token: string }>;
}) {
  const { token } = await params;

  return (
    <PageShell width="xs">
      <CardSection title="You're invited">
        <AcceptInvitation token={token} />
      </CardSection>
    </PageShell>
  );
}
