// Org members page. The parent layout has already verified the caller
// is a member of `orgId`. The roster is member-readable, so every
// member sees it — but read-only: the management controls (promote /
// demote / remove) and the pending-invitations section are admin-only,
// gated here on the caller's role from `findMine`. The OrgNav "Members"
// link is shown to everyone; Billing / Invite are not. The backing
// endpoints independently enforce their own gates.

import { CardSection } from "@org/components/patterns/card-section";
import { PageShell } from "@org/components/patterns/page-shell";
import { Skeleton } from "@org/components/primitives/skeleton";
import { Stack } from "@org/components/primitives/stack";
import { OrganizationId } from "@org/contracts/EntityIds";
import React from "react";

import { OrgInvitationsList } from "@/features/admin/org-invitations-list/org-invitations-list.view";
import { OrgMembersList } from "@/features/admin/org-members-list/org-members-list.view";
import { AtomHydrationBoundary } from "@/services/atom/hydration-boundary";
import { fetchMyOrgRole } from "@/services/data-access/my-orgs.server";
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

export default async function OrgMembersPage({
  params,
}: {
  readonly params: Promise<{ readonly orgId: string }>;
}) {
  const { orgId: raw } = await params;
  const orgId = OrganizationId.make(raw);

  // The layout guarantees membership, so role is "admin" | "member".
  const isAdmin = (await fetchMyOrgRole(orgId)) === "admin";

  return (
    <PageShell>
      <CardSection title="Members">
        <AtomHydrationBoundary prefetch={[prefetchOrgMembers(orgId)]} fallback={<Fallback />}>
          <OrgMembersList orgId={orgId} canManage={isAdmin} />
        </AtomHydrationBoundary>
      </CardSection>

      {isAdmin && (
        <CardSection title="Pending invitations" titleSize="lg">
          <AtomHydrationBoundary prefetch={[prefetchOrgInvitations(orgId)]} fallback={<Fallback />}>
            <OrgInvitationsList orgId={orgId} />
          </AtomHydrationBoundary>
        </CardSection>
      )}
    </PageShell>
  );
}
