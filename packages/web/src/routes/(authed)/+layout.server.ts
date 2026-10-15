// Server-side auth guard for every authed route: no session redirects to the
// BFF's login before anything renders (ADR-0017, ADR-0018). A member's
// organizations are prefetched here so the nav's switcher hydrates on first
// paint; super-admins own no organizations and see no switcher.
import { redirect } from "@sveltejs/kit";
import * as Option from "effect/Option";

import { collectPrefetched, type Prefetch } from "@/services/atom/prefetch.server";
import { fetchCurrentUser } from "@/services/data-access/me.server";
import { prefetchMyOrgs } from "@/services/data-access/orgs.server";

const navPrefetches = (isSuperAdmin: boolean): ReadonlyArray<Prefetch> => {
  if (isSuperAdmin) return [];

  return [prefetchMyOrgs];
};

export const load = async () => {
  const user = await fetchCurrentUser();

  if (Option.isNone(user)) redirect(302, "/api/auth/login");

  const { isSuperAdmin } = user.value;

  // A load's data crosses to the browser as plain values, so the user is
  // reduced to what the routes below read rather than handed over as a class.
  return {
    user: { isSuperAdmin },
    prefetched: await collectPrefetched(navPrefetches(isSuperAdmin)),
  };
};
