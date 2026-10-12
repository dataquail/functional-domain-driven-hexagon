// Server-side auth guard for every authed route: no session redirects to the
// BFF's login before anything renders (ADR-0017, ADR-0018). A member's
// organizations are prefetched here so the nav's switcher hydrates on first
// paint; super-admins own no organizations and see no switcher.
import { redirect } from "@sveltejs/kit";

import { collectPrefetched } from "@/services/atom/prefetch.server";
import { fetchCurrentUser } from "@/services/data-access/me.server";
import { prefetchMyOrgs } from "@/services/data-access/orgs.server";

export const load = async () => {
  const user = await fetchCurrentUser();
  if (user === null) redirect(302, "/api/auth/login");
  // A load's data crosses to the browser as plain values, so the user is
  // reduced to what the routes below read rather than handed over as a class.
  return {
    user: { isSuperAdmin: user.isSuperAdmin },
    prefetched: await collectPrefetched(user.isSuperAdmin ? [] : [prefetchMyOrgs()]),
  };
};
