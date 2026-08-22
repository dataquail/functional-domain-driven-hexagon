// Super-admin invite surface for a specific org. Reuses the InviteForm
// feature — the underlying `inviteUser` endpoint's policy lets SAs
// through via the `SuperAdminOnly` OR chain.

import { CardSection } from "@org/components/patterns/card-section";
import { PageShell } from "@org/components/patterns/page-shell";
import { Link } from "@org/components/primitives/link";
import { OrganizationId } from "@org/contracts/EntityIds";
import React from "react";

import { InviteForm } from "@/features/invite/invite-form/invite-form.view";

export default async function AdminOrgInvitePage({
  params,
}: {
  readonly params: Promise<{ readonly orgId: string }>;
}) {
  const { orgId: raw } = await params;
  const orgId = OrganizationId.make(raw);

  return (
    <PageShell width="sm">
      <CardSection
        title="Invite a user"
        action={
          <Link href={`/admin/orgs/${orgId}`} tone="muted" underline="none">
            ← Back to org
          </Link>
        }
      >
        <InviteForm orgId={orgId} />
      </CardSection>
    </PageShell>
  );
}
