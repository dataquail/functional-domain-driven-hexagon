// Org-admin invite page. The endpoint itself enforces the org-admin
// check (403 on non-admin) and surfaces as a toast — the form renders
// for everyone in the org but only admins can successfully submit.

import { Card } from "@org/components/primitives/card";
import { OrganizationId } from "@org/contracts/EntityIds";
import React from "react";

import { InviteForm } from "@/features/invite/invite-form/invite-form";

export default async function InvitePage({
  params,
}: {
  readonly params: Promise<{ readonly orgId: string }>;
}) {
  const { orgId: raw } = await params;
  const orgId = OrganizationId.make(raw);

  return (
    <div className="mx-auto w-full max-w-lg px-4">
      <Card className="shadow-md">
        <Card.Header>
          <Card.Title className="text-2xl font-semibold">Invite a teammate</Card.Title>
        </Card.Header>
        <Card.Content>
          <InviteForm orgId={orgId} />
        </Card.Content>
      </Card>
    </div>
  );
}
