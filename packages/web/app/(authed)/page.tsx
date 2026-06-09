// Root authed route — the organization picker. Lists the caller's
// memberships as cards and offers a create-org form. Choosing an org
// navigates into `/orgs/[orgId]/` where the membership-guarded layout
// takes over. Phase 8 (ADR-0018).
//
// The `myOrgs` cache is prefetched by the parent (authed) layout for
// the nav switcher, so the picker hydrates from the same key without
// a duplicate fetch.

import { Card } from "@org/components/primitives/card";
import { Skeleton } from "@org/components/primitives/skeleton";
import React from "react";

import { CreateOrg } from "@/features/orgs/create-org/create-org";
import { OrgPicker } from "@/features/orgs/org-picker/org-picker";

const Fallback: React.FC = () => (
  <div className="grid gap-3 sm:grid-cols-2">
    {Array.from({ length: 2 }, (_, i) => (
      <Skeleton key={i} className="h-20 w-full rounded-lg" />
    ))}
  </div>
);

export default function RootPickerPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4">
      <Card className="shadow-md">
        <Card.Header>
          <Card.Title className="text-2xl font-semibold">Your organizations</Card.Title>
        </Card.Header>
        <Card.Content>
          <React.Suspense fallback={<Fallback />}>
            <OrgPicker />
          </React.Suspense>
        </Card.Content>
      </Card>

      <Card className="shadow-md">
        <Card.Header>
          <Card.Title className="text-2xl font-semibold">Create a new organization</Card.Title>
        </Card.Header>
        <Card.Content>
          <CreateOrg />
        </Card.Content>
      </Card>
    </div>
  );
}
