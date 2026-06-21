// Org-admin member-management page. The parent layout has already
// verified the caller is a member of `orgId`; this page additionally
// requires org-admin (or super-admin) to *see* the roster, since the
// backing `findMembers` endpoint is `update`-gated. A plain member who
// navigates here (the OrgNav "Members" link is shown to everyone, per
// the always-show convention) gets a friendly notice rather than a
// crash — the server probe distinguishes the 403 from real failures.

import { Card } from "@org/components/primitives/card";
import { Skeleton } from "@org/components/primitives/skeleton";
import { OrganizationId } from "@org/contracts/EntityIds";
import React from "react";

import { OrgMembersList } from "@/features/admin/org-members-list/org-members-list";
import { ServerHydrationBoundary } from "@/lib/tanstack-query/server-hydration-boundary";
import {
  fetchOrgMembersGuarded,
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

  const probe = await fetchOrgMembersGuarded(orgId);

  return (
    <div className="mx-auto w-full max-w-3xl px-4">
      <Card className="shadow-md">
        <Card.Header>
          <Card.Title className="text-2xl font-semibold">Members</Card.Title>
        </Card.Header>
        <Card.Content>
          {probe === "forbidden" ? (
            <div className="rounded-lg bg-muted/50 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Only organization admins can manage members.
              </p>
            </div>
          ) : (
            <ServerHydrationBoundary prefetch={[prefetchOrgMembers(orgId)]} fallback={<Fallback />}>
              <OrgMembersList orgId={orgId} />
            </ServerHydrationBoundary>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}
