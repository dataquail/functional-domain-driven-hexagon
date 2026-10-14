// Membership guard for /orgs/[orgId]/*: an org the caller does not belong to
// is a Not Found rather than a silent bounce, so a stale share link explains
// itself.
import { OrganizationId } from "@org/contracts/EntityIds";
import { error } from "@sveltejs/kit";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";

import { fetchMyOrgs } from "@/services/data-access/my-orgs.server";

export const load = async ({ params }: { readonly params: { readonly orgId: string } }) => {
  const orgs = await fetchMyOrgs();
  const member = Arr.findFirst(orgs, (org) => org.id === params.orgId);

  if (Option.isNone(member)) error(404, "Not Found");

  return { orgId: OrganizationId.make(params.orgId), isAdmin: member.value.isAdmin };
};
