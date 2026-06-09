// Server-side auth guard for every authed route. Calls `/auth/me`;
// failure (no/expired session) `redirect()`s to the BFF login flow,
// which never paints on the client — the redirect throw is unwound
// before the layout renders. ADR-0017 / ADR-0018.
//
// For regular users we prefetch their organizations here so the nav's
// org switcher hydrates on first paint. Super-admins are a disjoint
// user type — they don't own/join orgs and the nav doesn't render the
// switcher for them, so we skip the prefetch entirely.
//
// `redirect()` throws a NEXT_REDIRECT marker that React unwinds before
// rendering. It must NOT be wrapped in try/catch — otherwise the marker
// is swallowed and the redirect silently fails.

import { redirect } from "next/navigation";
import * as React from "react";

import { Nav } from "@/features/__root/nav";
import { ServerHydrationBoundary } from "@/lib/tanstack-query/server-hydration-boundary";
import { fetchCurrentUser } from "@/services/data-access/me.server";
import { prefetchMyOrgs } from "@/services/data-access/orgs-queries.server";

export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  const me = await fetchCurrentUser();
  if (me === null) {
    redirect("/api/auth/login");
  }

  const prefetch = me.isSuperAdmin ? [] : [prefetchMyOrgs()];

  return (
    <ServerHydrationBoundary prefetch={prefetch} fallback={null}>
      <main className="flex min-h-screen flex-col bg-background">
        <Nav />
        <div className="flex flex-1 flex-col py-12">{children}</div>
      </main>
    </ServerHydrationBoundary>
  );
}
