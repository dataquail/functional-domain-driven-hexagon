// Org members page. The parent layout has already verified the caller
// is a member of `orgId`. The roster is member-readable, so every
// member sees it — but read-only: the management controls (promote /
// demote / remove) and the pending-invitations section are admin-only,
// gated here on the caller's role from `findMine`. The OrgNav "Members"
// link is shown to everyone; Billing / Invite are not. The backing
// endpoints independently enforce their own gates.

import { Card } from "@org/components/primitives/card";
import { Skeleton } from "@org/components/primitives/skeleton";
import { OrganizationId } from "@org/contracts/EntityIds";
import React from "react";

import { OrgInvitationsList } from "@/features/admin/org-invitations-list/org-invitations-list";
import { OrgMembersList } from "@/features/admin/org-members-list/org-members-list";
import { ServerHydrationBoundary } from "@/lib/tanstack-query/server-hydration-boundary";
import { fetchMyOrgRole } from "@/services/data-access/my-orgs.server";
import {
  prefetchOrgInvitations,
  prefetchOrgMembers,
} from "@/services/data-access/org-members-queries.server";

const Fallback: React.FC = () => (
  <div className="space-y-2">
    {Array.from({ length: 3 }, (_, i) => (
      <Skeleton key={i} className="h-14 w-full rounded-md" />
    ))}
  </div>
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
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4">
      <Card className="shadow-md">
        <Card.Header>
          <Card.Title className="text-2xl font-semibold">Members</Card.Title>
        </Card.Header>
        <Card.Content>
          <ServerHydrationBoundary prefetch={[prefetchOrgMembers(orgId)]} fallback={<Fallback />}>
            <OrgMembersList orgId={orgId} canManage={isAdmin} />
          </ServerHydrationBoundary>
        </Card.Content>
      </Card>

      {isAdmin ? (
        <Card className="shadow-md">
          <Card.Header>
            <Card.Title className="text-xl font-semibold">Pending invitations</Card.Title>
          </Card.Header>
          <Card.Content>
            <ServerHydrationBoundary
              prefetch={[prefetchOrgInvitations(orgId)]}
              fallback={<Fallback />}
            >
              <OrgInvitationsList orgId={orgId} />
            </ServerHydrationBoundary>
          </Card.Content>
        </Card>
      ) : null}
    </div>
  );
}
