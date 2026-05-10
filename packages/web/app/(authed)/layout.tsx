// Server-side auth guard. ADR-0018 § "ADR-0017 changes" — the guard moves
// from a client component (the existing SPA's `<AuthGuard>` in
// features/__root/auth-guard.tsx) to a server component. The check is
// the same — call `/auth/me` via the BFF — but the redirect is server-
// side `redirect()` from `next/navigation`, so the unauthenticated case
// never paints on the client. The blank-surface UX from the SPA's guard
// disappears because the layout doesn't render until the check resolves.
//
// The (authed) folder is a Next route group: `(authed)/page.tsx` maps to
// `/`, `(authed)/users/page.tsx` to `/users`. The parens keep the
// segment out of the URL while letting the layout wrap every authed
// route in one place.
//
// Note: `redirect()` throws a NEXT_REDIRECT marker that React unwinds
// before rendering. It must NOT be wrapped in try/catch — otherwise
// the marker is swallowed and the redirect silently fails.

import { Nav } from "@/features/__root/nav";
import { ApiClient } from "@/services/api-client.shared";
import { getServerRuntime } from "@/services/runtime.server";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { redirect } from "next/navigation";

export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  const runtime = await getServerRuntime();
  const exit = await runtime.runPromiseExit(
    Effect.flatMap(ApiClient, ({ client }) => client.authSession.me()),
  );

  if (Exit.isFailure(exit)) {
    // Server-mediated OIDC dance. The BFF sets the session cookie on
    // the response, which travels back through Next's `/api/*` rewrite
    // and scopes to the Next origin. ADR-0018 § "How the /api/* proxy
    // works" for the cookie-flow rationale.
    redirect("/api/auth/login");
  }

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <Nav />
      <div className="flex flex-1 flex-col py-12">{children}</div>
    </main>
  );
}
