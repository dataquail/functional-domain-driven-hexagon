// Server-only: resolve the caller's primary organization id, creating
// a default org if they have none yet.
//
// Bridge for Phase 5. The contract is now org-scoped (`/orgs/:orgId/todos`)
// but the frontend doesn't have an org-aware route surface yet —
// that's Phase 8. Until then, the (authed) page treats the caller's
// first organization as the implicit working org; on first sign-in
// the server creates "My Workspace" so the todos UI has somewhere to
// land. When Phase 8 introduces `/orgs/[orgId]/todos`, this helper
// goes away and orgId comes from the URL segment instead.

import "server-only";

import type { OrganizationId } from "@org/contracts/EntityIds";
import * as Effect from "effect/Effect";

import { ApiClient } from "@/services/api-client.shared";
import { getServerRuntime } from "@/services/runtime.server";

const DEFAULT_ORG_NAME = "My Workspace";

export const ensurePrimaryOrgId = async (): Promise<OrganizationId> => {
  const runtime = await getServerRuntime();
  return runtime.runPromise(
    Effect.gen(function* () {
      const { client } = yield* ApiClient;
      const mine = yield* client.organization.findMine();
      if (mine.length > 0) return mine[0].id;
      const created = yield* client.organization.create({
        payload: { name: DEFAULT_ORG_NAME },
      });
      return created.id;
    }),
  );
};
