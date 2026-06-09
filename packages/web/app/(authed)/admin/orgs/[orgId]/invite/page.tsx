// Super-admin invite surface for a specific org. Reuses the InviteForm
// feature — the underlying `inviteUser` endpoint's policy lets SAs
// through via the `SuperAdminOnly` OR chain.

import { Card } from "@org/components/primitives/card";
import { OrganizationId } from "@org/contracts/EntityIds";
import Link from "next/link";
import React from "react";

import { InviteForm } from "@/features/invite/invite-form/invite-form";

export default async function AdminOrgInvitePage({
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
          <div className="flex items-center justify-between gap-3">
            <Card.Title className="text-2xl font-semibold">Invite a user</Card.Title>
            <Link
              href={`/admin/orgs/${orgId}`}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back to org
            </Link>
          </div>
        </Card.Header>
        <Card.Content>
          <InviteForm orgId={orgId} />
        </Card.Content>
      </Card>
    </div>
  );
}
