// Billing page for an organization. Membership is verified by the
// parent /orgs/[orgId]/layout.tsx; this page additionally requires
// org-admin — managing billing is an admin-only surface. A non-admin
// who deep-links here gets a 404 (the OrgNav hides the link). The
// `update`-gated billing endpoints hard-block mutations regardless;
// the guard is defense-in-depth + a clean UX. It prefetches the current
// subscription so the panel hydrates on first paint.

import { CardSection } from "@org/components/patterns/card-section";
import { PageShell } from "@org/components/patterns/page-shell";
import { Skeleton } from "@org/components/primitives/skeleton";
import { Stack } from "@org/components/primitives/stack";
import { OrganizationId } from "@org/contracts/EntityIds";
import { notFound } from "next/navigation";
import React from "react";

import { BillingPanel } from "@/features/billing/billing-panel/billing-panel.view";
import { AtomHydrationBoundary } from "@/services/atom/hydration-boundary";
import { prefetchSubscription } from "@/services/data-access/billing.server";
import { fetchMyOrgRole } from "@/services/data-access/my-orgs.server";

const Fallback: React.FC = () => (
  <Stack direction="column" gap="lg">
    <Skeleton height="control" width="half" />
    <Skeleton height="control" width="half" />
  </Stack>
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
    <PageShell>
      <CardSection title="Billing">
        <AtomHydrationBoundary prefetch={[prefetchSubscription(orgId)]} fallback={<Fallback />}>
          <BillingPanel orgId={orgId} />
        </AtomHydrationBoundary>
      </CardSection>
    </PageShell>
  );
}
