// Server-only helper: resolve the caller's organization memberships
// without going through Suspense. The (authed)/orgs/[orgId] layout
// uses this for its membership guard; the root org picker reads it
// to render cards; the redirect-after-create flow consumes it.

import "server-only";

import type { OrganizationContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";

import { ApiClient } from "@/services/api-client.shared";
import { getServerRuntime } from "@/services/runtime.server";

export const fetchMyOrgs = async (): Promise<ReadonlyArray<OrganizationContract.Organization>> => {
  const runtime = await getServerRuntime();
  return runtime.runPromise(
    Effect.flatMap(ApiClient, ({ client }) => client.organization.findMine()),
  );
};
