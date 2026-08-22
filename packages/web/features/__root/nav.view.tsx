// Top-level nav for the authed shell. A dumb projection: the caller's user
// type is resolved once by the layout and handed down, so this file has no
// data access of its own.
//
// Super-admins are a disjoint user type — they don't own or join organizations
// (enforced server-side in `createOrganization` / `acceptInvitation`), so the
// org switcher + create-new button are hidden for them. Their nav surfaces the
// admin links (Users + Admin orgs) instead; regular users see neither.

import { Container } from "@org/components/primitives/container";
import { Link } from "@org/components/primitives/link";
import { Nav as NavBar } from "@org/components/primitives/nav";
import { Skeleton } from "@org/components/primitives/skeleton";
import { Stack } from "@org/components/primitives/stack";
import * as React from "react";

import { OrgSwitcher } from "@/features/__root/org-switcher/org-switcher.view";

const SwitcherFallback: React.FC = () => <Skeleton width="switcher" height="control" />;

export const Nav: React.FC<{ readonly isSuperAdmin: boolean }> = ({ isSuperAdmin }) => {
  return (
    <NavBar orientation="block" tone="bar" aria-label="Main">
      <Container width="lg" paddingX="md" paddingY="sm">
        <Stack direction="row" gap="sm" align="center">
          <Link
            href={isSuperAdmin ? "/admin/orgs" : "/"}
            appearance="nav-item"
            tone="default"
            underline="none"
          >
            Home
          </Link>

          {isSuperAdmin ? null : (
            <React.Suspense fallback={<SwitcherFallback />}>
              <OrgSwitcher />
            </React.Suspense>
          )}

          <Stack direction="row" gap="xs" align="center" grow justify="end">
            {isSuperAdmin ? (
              <React.Fragment>
                <Link
                  href="/users"
                  appearance="nav-item"
                  tone="default"
                  underline="none"
                  data-testid="nav-users"
                >
                  Users
                </Link>
                <Link
                  href="/admin/orgs"
                  appearance="nav-item"
                  tone="default"
                  underline="none"
                  data-testid="nav-admin"
                >
                  Admin
                </Link>
              </React.Fragment>
            ) : null}
            <Link
              href="/api/auth/logout"
              external
              appearance="nav-item"
              tone="default"
              underline="none"
            >
              Sign out
            </Link>
          </Stack>
        </Stack>
      </Container>
    </NavBar>
  );
};
