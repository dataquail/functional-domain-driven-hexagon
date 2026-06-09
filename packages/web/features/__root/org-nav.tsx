// Org-scoped sub-nav. Rendered by (authed)/orgs/[orgId]/layout.tsx
// once membership is verified, so the orgId is known up front and we
// can build static hrefs. The Invite link is always shown — non-admin
// callers see a 403 from the underlying mutation, which surfaces as a
// toast. Hiding it conditionally requires either a server-side role
// probe per render or an `is-org-admin` ACL endpoint; deferred until a
// real product surface needs it.

import type { OrganizationId } from "@org/contracts/EntityIds";
import Link from "next/link";

export const OrgNav: React.FC<{ readonly orgId: OrganizationId }> = ({ orgId }) => {
  const base = `/orgs/${orgId}`;
  const links: ReadonlyArray<{ href: string; label: string; testid: string }> = [
    { href: `${base}`, label: "Tasks", testid: "org-nav-tasks" },
    { href: `${base}/billing`, label: "Billing", testid: "org-nav-billing" },
    { href: `${base}/invite`, label: "Invite", testid: "org-nav-invite" },
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
