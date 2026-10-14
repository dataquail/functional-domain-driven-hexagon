// Server-only helper: resolve the caller's organization memberships
// without going through Suspense. The (authed)/orgs/[orgId] layout
// uses this for its membership guard; the root org picker reads it
// to render cards; the redirect-after-create flow consumes it.

import type { OrganizationContract } from "@org/contracts/api/Contracts";
import type { OrganizationId } from "@org/contracts/EntityIds";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { ApiClient } from "@/services/api-client.shared";
import { getServerRuntime } from "@/services/runtime.server";

export const fetchMyOrgs = async (): Promise<
  ReadonlyArray<OrganizationContract.MyOrganization>
> => {
  const runtime = await getServerRuntime();

  return runtime.runPromise(
    Effect.flatMap(ApiClient, ({ client }) => client.organization.findMine()),
  );
};

// The caller's role in one org, derived from their `findMine` list:
// `"admin"` when they hold the org's `admin` role, `"member"` when they
// belong but don't, none when they aren't a member at all (the org isn't
// in their list). Server components use this to gate
// admin-only surfaces; the backend still hard-blocks the underlying
// endpoints regardless.
export type OrgRole = "admin" | "member";

const roleOf = (org: OrganizationContract.MyOrganization): OrgRole => {
  if (org.isAdmin) return "admin";

  return "member";
};

export const fetchMyOrgRole = async (orgId: OrganizationId): Promise<Option.Option<OrgRole>> => {
  const orgs = await fetchMyOrgs();

  return Option.map(
    Arr.findFirst(orgs, (org) => org.id === orgId),
    roleOf,
  );
};
