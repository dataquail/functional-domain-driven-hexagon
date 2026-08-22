// Root authed route. Two branches depending on the caller's user type:
// - Regular user → organization picker (their memberships) + create-org
//   form. Choosing an org navigates into `/orgs/[orgId]/`.
// - Super-admin → redirect to `/admin/orgs`. SAs are a disjoint user
//   type, they don't own organizations, and their natural landing
//   page is the platform-wide org admin view.
//
// The `myOrgs` atom is prefetched by the parent (authed) layout for the
// nav switcher (regular users only); the picker reads the same atom and
// hydrates from that entry without a duplicate fetch.

import { CardSection } from "@org/components/patterns/card-section";
import { PageShell } from "@org/components/patterns/page-shell";
import { Grid } from "@org/components/primitives/grid";
import { Skeleton } from "@org/components/primitives/skeleton";
import { redirect } from "next/navigation";
import React from "react";

import { CreateOrg } from "@/features/orgs/create-org/create-org.view";
import { OrgPicker } from "@/features/orgs/org-picker/org-picker.view";
import { fetchCurrentUser } from "@/services/data-access/me.server";

const Fallback: React.FC = () => (
  <Grid columnsAbove={2} gap="md">
    {Array.from({ length: 2 }, (_, index) => (
      <Grid.Item key={index}>
        <Skeleton height="card" radius="lg" />
      </Grid.Item>
    ))}
  </Grid>
);

export default async function RootPickerPage() {
  const me = await fetchCurrentUser();
  if (me?.isSuperAdmin === true) {
    redirect("/admin/orgs");
  }

  return (
    <PageShell>
      <CardSection title="Your organizations">
        <React.Suspense fallback={<Fallback />}>
          <OrgPicker />
        </React.Suspense>
      </CardSection>

      <CardSection title="Create a new organization">
        <CreateOrg />
      </CardSection>
    </PageShell>
  );
}
