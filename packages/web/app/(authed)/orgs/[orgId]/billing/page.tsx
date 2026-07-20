// Billing page for an organization. Membership is verified by the
// parent /orgs/[orgId]/layout.tsx; this page additionally requires
// org-admin — managing billing is an admin-only surface. A non-admin
// who deep-links here gets a 404 (the OrgNav hides the link). The
// `update`-gated billing endpoints hard-block mutations regardless;
// the guard is defense-in-depth + a clean UX. It prefetches the current
// subscription so the panel hydrates on first paint.

import { Card } from "@org/components/primitives/card";
import { Skeleton } from "@org/components/primitives/skeleton";
import { OrganizationId } from "@org/contracts/EntityIds";
import { notFound } from "next/navigation";
import React from "react";

import { BillingPanel } from "@/features/billing/billing-panel/billing-panel.view";
import { ServerHydrationBoundary } from "@/lib/tanstack-query/server-hydration-boundary";
import { prefetchCurrentSubscription } from "@/services/data-access/billing-queries.server";
import { fetchMyOrgRole } from "@/services/data-access/my-orgs.server";

const Fallback: React.FC = () => (
  <div className="space-y-4">
    <Skeleton className="h-12 w-1/2" />
    <Skeleton className="h-10 w-40" />
  </div>
);

export default async function BillingPage({
  params,
}: {
  readonly params: Promise<{ readonly orgId: string }>;
}) {
  const { orgId: raw } = await params;
  const orgId = OrganizationId.make(raw);

  if ((await fetchMyOrgRole(orgId)) !== "admin") notFound();

  return (
    <div className="mx-auto w-full max-w-3xl px-4">
      <Card className="shadow-md">
        <Card.Header>
          <Card.Title className="text-2xl font-semibold">Billing</Card.Title>
        </Card.Header>
        <Card.Content>
          <ServerHydrationBoundary
            prefetch={[prefetchCurrentSubscription(orgId)]}
            fallback={<Fallback />}
          >
            <BillingPanel orgId={orgId} />
          </ServerHydrationBoundary>
        </Card.Content>
      </Card>
    </div>
  );
}
