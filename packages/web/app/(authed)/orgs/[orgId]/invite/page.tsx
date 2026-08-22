// Org-admin invite page. Inviting teammates is an admin-only surface:
// the OrgNav hides the link for non-admins and this page 404s a non-
// admin who deep-links here. The `inviteUser` endpoint independently
// enforces the org-admin check (403), so the guard is defense-in-depth
// + a clean UX rather than the security boundary.

import { CardSection } from "@org/components/patterns/card-section";
import { PageShell } from "@org/components/patterns/page-shell";
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
    <PageShell width="sm">
      <CardSection title="Invite a teammate">
        <InviteForm orgId={orgId} />
      </CardSection>
    </PageShell>
  );
}
