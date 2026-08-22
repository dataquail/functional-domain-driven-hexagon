// Org-scoped sub-nav. Rendered by (authed)/orgs/[orgId]/layout.tsx
// once membership is verified, so the orgId is known up front and we
// can build static hrefs. Billing and Invite are admin-only surfaces,
// so their links are shown only when the caller is an org admin (the
// layout reads this from the caller's `findMine` role). Tasks and
// Members are visible to every member — Members renders a read-only
// roster for non-admins. The backend independently gates each endpoint,
// so hiding the links is a UX affordance, not the security boundary.

import { Container } from "@org/components/primitives/container";
import { Link } from "@org/components/primitives/link";
import { Nav } from "@org/components/primitives/nav";
import { Stack } from "@org/components/primitives/stack";
import { Surface } from "@org/components/primitives/surface";
import type { OrganizationId } from "@org/contracts/EntityIds";

export const OrgNav: React.FC<{ readonly orgId: OrganizationId; readonly isAdmin: boolean }> = ({
  isAdmin,
  orgId,
}) => {
  const base = `/orgs/${orgId}`;
  const links: ReadonlyArray<{ href: string; label: string; testid: string }> = [
    { href: `${base}`, label: "Tasks", testid: "org-nav-tasks" },
    { href: `${base}/members`, label: "Members", testid: "org-nav-members" },
    ...(isAdmin
      ? [
          { href: `${base}/billing`, label: "Billing", testid: "org-nav-billing" },
          { href: `${base}/invite`, label: "Invite", testid: "org-nav-invite" },
        ]
      : []),
  ];

  return (
    <Surface tone="subtle" border="bottom">
      <Nav orientation="block" aria-label="Organization">
        <Container width="lg" paddingX="md" paddingY="xs">
          <Stack direction="row" gap="xs" align="center">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                appearance="nav-item"
                tone="muted"
                underline="none"
                data-testid={link.testid}
              >
                {link.label}
              </Link>
            ))}
          </Stack>
        </Container>
      </Nav>
    </Surface>
  );
};
