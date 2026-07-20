// Root authed route. Two branches depending on the caller's user type:
// - Regular user → organization picker (their memberships) + create-org
//   form. Choosing an org navigates into `/orgs/[orgId]/`.
// - Super-admin → redirect to `/admin/orgs`. SAs are a disjoint user
//   type, they don't own organizations, and their natural landing
//   page is the platform-wide org admin view.
//
// The `myOrgs` cache is prefetched by the parent (authed) layout for
// the nav switcher (regular users only); the picker hydrates from
// that same key without a duplicate fetch.

import { Card } from "@org/components/primitives/card";
import { Skeleton } from "@org/components/primitives/skeleton";
import { redirect } from "next/navigation";
import React from "react";

import { CreateOrg } from "@/features/orgs/create-org/create-org.view";
import { OrgPicker } from "@/features/orgs/org-picker/org-picker.view";
import { fetchCurrentUser } from "@/services/data-access/me.server";

const Fallback: React.FC = () => (
  <div className="grid gap-3 sm:grid-cols-2">
    {Array.from({ length: 2 }, (_, i) => (
      <Skeleton key={i} className="h-20 w-full rounded-lg" />
    ))}
  </div>
);

export default async function RootPickerPage() {
  const me = await fetchCurrentUser();
  if (me?.isSuperAdmin === true) {
    redirect("/admin/orgs");
  }

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
