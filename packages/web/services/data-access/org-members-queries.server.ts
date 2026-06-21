import "server-only";

import type { OrganizationContract } from "@org/contracts/api/Contracts";
import type { OrganizationId } from "@org/contracts/EntityIds";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";

import { prefetchEffectQuery } from "@/lib/tanstack-query/effect-prefetch.server";
import { getServerRuntime } from "@/services/runtime.server";

import { orgMembersQuery, orgMembersQueryKey } from "./org-members-queries";

export const prefetchOrgMembers = (orgId: OrganizationId): Promise<void> =>
  prefetchEffectQuery({
    queryKey: orgMembersQueryKey({ orgId }),
    queryFn: orgMembersQuery(orgId),
  });

// Server-side admin probe for the org-admin members page. The
// `findMembers` endpoint is `update`-gated, so a plain member gets a
// 403 — which is an *expected* state for this surface (the page is
// admin-only), not a crash. Returns `"forbidden"` for that case so the
// page can render a friendly notice; re-throws genuine failures so they
// reach the error boundary. Mirrors `me.server.ts`'s `runPromiseExit`
// shape.
export const fetchOrgMembersGuarded = async (
  orgId: OrganizationId,
): Promise<OrganizationContract.OrganizationMembersResponse | "forbidden"> => {
  const runtime = await getServerRuntime();
  const exit = await runtime.runPromiseExit(orgMembersQuery(orgId));
  if (Exit.isSuccess(exit)) return exit.value;

  const failure = Cause.failureOption(exit.cause);
  if (Option.isSome(failure) && failure.value._tag === "Forbidden") return "forbidden";
  throw new Error(`Failed to load organization members: ${Cause.pretty(exit.cause)}`);
};
