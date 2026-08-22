// Super-admin drill-in to a specific org. Shows the member list with
// a Remove action; reuses the existing org-level `inviteUser` and
// `removeMember` endpoints (their policies pass SAs through the
// `SuperAdminOnly` OR chain). The /admin layout guard restricts this
// route to super-admins; non-SAs `notFound()`.
//
// Intentionally no todos here — the SA's purpose for entering an org
// is membership + billing management, not content access.

import { CardSection } from "@org/components/patterns/card-section";
import { PageShell } from "@org/components/patterns/page-shell";
import { Link } from "@org/components/primitives/link";
import { Skeleton } from "@org/components/primitives/skeleton";
import { Stack } from "@org/components/primitives/stack";
import { OrganizationId } from "@org/contracts/EntityIds";
import React from "react";

import { OrgInvitationsList } from "@/features/admin/org-invitations-list/org-invitations-list.view";
import { OrgMembersList } from "@/features/admin/org-members-list/org-members-list.view";
import { AtomHydrationBoundary } from "@/services/atom/hydration-boundary";
import {
  prefetchOrgInvitations,
  prefetchOrgMembers,
} from "@/services/data-access/org-members.server";

const Fallback: React.FC = () => (
  <Stack direction="column" gap="sm">
    {Array.from({ length: 3 }, (_, index) => (
      <Skeleton key={index} height="row" />
    ))}
  </Stack>
);

export default async function AdminOrgDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly orgId: string }>;
}) {
  const { orgId: raw } = await params;
  const orgId = OrganizationId.make(raw);

  return (
    <PageShell>
      <CardSection
        title="Organization members"
        action={
          <Link
            href={`/admin/orgs/${orgId}/invite`}
            appearance="button"
            tone="default"
            underline="none"
            data-testid="admin-org-invite-link"
          >
            + Invite user
          </Link>
        }
      >
        <AtomHydrationBoundary prefetch={[prefetchOrgMembers(orgId)]} fallback={<Fallback />}>
          <OrgMembersList orgId={orgId} />
        </AtomHydrationBoundary>
      </CardSection>

      <CardSection title="Pending invitations" titleSize="lg">
        <AtomHydrationBoundary prefetch={[prefetchOrgInvitations(orgId)]} fallback={<Fallback />}>
          <OrgInvitationsList orgId={orgId} />
        </AtomHydrationBoundary>
      </CardSection>
    </PageShell>
  );
}
