// Super-admin /admin/orgs page. The backend's `findAll` endpoint
// gates via `Authz.hasPermissions(OrganizationResource, Actions.Read)`
// which only super-admins pass; non-admins see a 403 from the
// prefetch (surfaces as a Suspense error). Phase 9 can route the 403
// through a friendlier server-side check.

import { Card } from "@org/components/primitives/card";
import { Skeleton } from "@org/components/primitives/skeleton";
import React from "react";

import { OrgsList } from "@/features/admin/orgs-list/orgs-list";
import { ServerHydrationBoundary } from "@/lib/tanstack-query/server-hydration-boundary";
import { prefetchAdminOrgs } from "@/services/data-access/orgs-queries.server";

const PAGE_SIZE = 10;

const Fallback: React.FC = () => (
  <div className="space-y-2">
    {Array.from({ length: PAGE_SIZE }, (_, i) => (
      <Skeleton key={i} className="h-14 w-full rounded-md" />
    ))}
  </div>
);

export default function AdminOrgsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4">
      <Card className="shadow-md">
        <Card.Header>
          <Card.Title className="text-2xl font-semibold">All organizations</Card.Title>
        </Card.Header>
        <Card.Content>
          <ServerHydrationBoundary
            prefetch={[
              prefetchAdminOrgs({ page: 1, pageSize: PAGE_SIZE, includeDeleted: "false" }),
            ]}
            fallback={<Fallback />}
          >
            <OrgsList />
          </ServerHydrationBoundary>
        </Card.Content>
      </Card>
    </div>
  );
}
