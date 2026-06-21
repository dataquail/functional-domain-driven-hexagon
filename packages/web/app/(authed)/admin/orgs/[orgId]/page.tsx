// Super-admin drill-in to a specific org. Shows the member list with
// a Remove action; reuses the existing org-level `inviteUser` and
// `removeMember` endpoints (their policies pass SAs through the
// `SuperAdminOnly` OR chain). The /admin layout guard restricts this
// route to super-admins; non-SAs `notFound()`.
//
// Intentionally no todos here — the SA's purpose for entering an org
// is membership + billing management, not content access.

import { Card } from "@org/components/primitives/card";
import { Skeleton } from "@org/components/primitives/skeleton";
import { OrganizationId } from "@org/contracts/EntityIds";
import Link from "next/link";
import React from "react";

import { OrgMembersList } from "@/features/admin/org-members-list/org-members-list";
import { ServerHydrationBoundary } from "@/lib/tanstack-query/server-hydration-boundary";
import { prefetchOrgMembers } from "@/services/data-access/org-members-queries.server";

const Fallback: React.FC = () => (
  <div className="space-y-2">
    {Array.from({ length: 3 }, (_, i) => (
      <Skeleton key={i} className="h-14 w-full rounded-md" />
    ))}
  </div>
);

export default async function AdminOrgDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly orgId: string }>;
}) {
  const { orgId: raw } = await params;
  const orgId = OrganizationId.make(raw);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4">
      <Card className="shadow-md">
        <Card.Header>
          <div className="flex items-center justify-between gap-3">
            <Card.Title className="text-2xl font-semibold">Organization members</Card.Title>
            <Link
              href={`/admin/orgs/${orgId}/invite`}
              className="rounded-md border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
              data-testid="admin-org-invite-link"
            >
              + Invite user
            </Link>
          </div>
        </Card.Header>
        <Card.Content>
          <ServerHydrationBoundary prefetch={[prefetchOrgMembers(orgId)]} fallback={<Fallback />}>
            <OrgMembersList orgId={orgId} />
          </ServerHydrationBoundary>
        </Card.Content>
      </Card>
    </div>
  );
}
