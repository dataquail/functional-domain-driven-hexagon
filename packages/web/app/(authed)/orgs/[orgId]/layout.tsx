// Membership guard for the /orgs/[orgId]/* subtree. Calls `/orgs` via
// the BFF (the caller's `findMine` list) and 404s if the URL's orgId
// isn't in it. We use `notFound()` rather than `redirect("/")` so a
// share-link to an org you don't belong to surfaces as a Not Found
// page instead of bouncing the user without explanation. Super-admins
// who aren't a member fall out the same way — Phase 9 can add an
// "impersonate org" path if needed.

import { OrganizationId } from "@org/contracts/EntityIds";
import { notFound } from "next/navigation";
import * as React from "react";

import { OrgNav } from "@/features/__root/org-nav";
import { fetchMyOrgs } from "@/services/data-access/my-orgs.server";

export default async function OrgScopedLayout({
  children,
  params,
}: {
  readonly children: React.ReactNode;
  readonly params: Promise<{ readonly orgId: string }>;
}) {
  const { orgId } = await params;
  const orgs = await fetchMyOrgs();
  const member = orgs.find((o) => o.id === orgId);
  if (member === undefined) notFound();

  const typedOrgId = OrganizationId.make(orgId);

  return (
    <React.Fragment>
      <OrgNav orgId={typedOrgId} isAdmin={member.isAdmin} />
      <div className="flex flex-1 flex-col py-8">{children}</div>
    </React.Fragment>
  );
}
