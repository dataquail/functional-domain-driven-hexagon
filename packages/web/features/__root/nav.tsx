// Server component. Mirrors the nav from the existing SPA's
// features/__root/__root.tsx, but rendered server-side: no `useRuntime`,
// no `runtime.runFork` — sign-out is a plain `<a>` to the BFF logout
// endpoint (ADR-0017 § "Logout is a navigation"; the GET endpoint is
// idempotent and revokes the session row + clears the cookie).
//
// Active-link styling will move to a client component in Phase 4 once
// active state matters; until then the route is a static highlight.

import Link from "next/link";

export const Nav: React.FC = () => {
  return (
    <nav className="border-b bg-card">
      <div className="mx-auto flex max-w-3xl items-center gap-1 px-4 py-3">
        <Link
          href="/"
          className="rounded-md px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
        >
          Tasks
        </Link>
        <Link
          href="/users"
          className="rounded-md px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
        >
          Users
        </Link>
        <a
          href="/api/auth/logout"
          className="ml-auto rounded-md px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
        >
          Sign out
        </a>
      </div>
    </nav>
  );
};
