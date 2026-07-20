// Org-admin invite page. Inviting teammates is an admin-only surface:
// the OrgNav hides the link for non-admins and this page 404s a non-
// admin who deep-links here. The `inviteUser` endpoint independently
// enforces the org-admin check (403), so the guard is defense-in-depth
// + a clean UX rather than the security boundary.

import { Card } from "@org/components/primitives/card";
import { OrganizationId } from "@org/contracts/EntityIds";
import { notFound } from "next/navigation";
import React from "react";

import { InviteForm } from "@/features/invite/invite-form/invite-form.view";
import { fetchMyOrgRole } from "@/services/data-access/my-orgs.server";

export default async function InvitePage({
  params,
}: {
  readonly params: Promise<{ readonly orgId: string }>;
}) {
  const { orgId: raw } = await params;
  const orgId = OrganizationId.make(raw);

  if ((await fetchMyOrgRole(orgId)) !== "admin") notFound();

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
