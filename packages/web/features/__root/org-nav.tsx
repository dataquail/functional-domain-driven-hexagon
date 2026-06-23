// Org-scoped sub-nav. Rendered by (authed)/orgs/[orgId]/layout.tsx
// once membership is verified, so the orgId is known up front and we
// can build static hrefs. Billing and Invite are admin-only surfaces,
// so their links are shown only when the caller is an org admin (the
// layout reads this from the caller's `findMine` role). Tasks and
// Members are visible to every member — Members renders a read-only
// roster for non-admins. The backend independently gates each endpoint,
// so hiding the links is a UX affordance, not the security boundary.

import type { OrganizationId } from "@org/contracts/EntityIds";
import Link from "next/link";

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
    <div className="border-b bg-muted/40">
      <div className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            data-testid={link.testid}
            className="rounded-md px-3 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
};
