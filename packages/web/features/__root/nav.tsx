// Top-level nav for the authed shell. Server component; renders the
// client-side org switcher inline so the active org can be chosen
// from any route. The conditional Admin link surfaces only when
// `/auth/me` reports super_admin — pages still gate themselves
// server-side, the link is just discoverability.

import Link from "next/link";
import * as React from "react";

import { OrgSwitcher } from "@/features/__root/org-switcher/org-switcher";
import { fetchCurrentUser } from "@/services/data-access/me.server";

export const Nav = async () => {
  const me = await fetchCurrentUser();
  const isSuperAdmin = me?.isSuperAdmin ?? false;

  return (
    <nav className="border-b bg-card">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
        <Link
          href="/"
          className="rounded-md px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
        >
          Home
        </Link>
        <React.Suspense
          fallback={<div className="h-9 w-[200px] animate-pulse rounded-md bg-muted/40" />}
        >
          <OrgSwitcher />
        </React.Suspense>
        <div className="ml-auto flex items-center gap-1">
          {isSuperAdmin ? (
            <React.Fragment>
              <Link
                href="/users"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
                data-testid="nav-users"
              >
                Users
              </Link>
              <Link
                href="/admin/orgs"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
                data-testid="nav-admin"
              >
                Admin
              </Link>
            </React.Fragment>
          ) : null}
          <a
            href="/api/auth/logout"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
          >
            Sign out
          </a>
        </div>
      </div>
    </nav>
  );
};
