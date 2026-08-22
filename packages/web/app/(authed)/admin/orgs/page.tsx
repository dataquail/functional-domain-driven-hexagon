// Super-admin /admin/orgs page. The backend's `findAll` endpoint
// gates via `Authz.hasPermissions(OrganizationResource, Actions.Read)`
// which only super-admins pass; non-admins see a 403 from the
// prefetch (surfaces as a Suspense error). Phase 9 can route the 403
// through a friendlier server-side check.

import { CardSection } from "@org/components/patterns/card-section";
import { PageShell } from "@org/components/patterns/page-shell";
import { Skeleton } from "@org/components/primitives/skeleton";
import { Stack } from "@org/components/primitives/stack";
import React from "react";

import { OrgsList } from "@/features/admin/orgs-list/orgs-list.view";
import { AtomHydrationBoundary } from "@/services/atom/hydration-boundary";
import { prefetchAdminOrgs } from "@/services/data-access/orgs.server";

const PAGE_SIZE = 10;

const Fallback: React.FC = () => (
  <Stack direction="column" gap="sm">
    {Array.from({ length: PAGE_SIZE }, (_, index) => (
      <Skeleton key={index} height="row" />
    ))}
  </Stack>
);

export default function AdminOrgsPage() {
  return (
    <PageShell>
      <CardSection title="All organizations">
        <AtomHydrationBoundary
          prefetch={[prefetchAdminOrgs({ page: 1, pageSize: PAGE_SIZE, includeDeleted: "false" })]}
          fallback={<Fallback />}
        >
          <OrgsList />
        </AtomHydrationBoundary>
      </CardSection>
    </PageShell>
  );
}
