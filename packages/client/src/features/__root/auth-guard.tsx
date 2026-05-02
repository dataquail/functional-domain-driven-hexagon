import { AuthQueries } from "@/services/data-access/auth-queries";
import { useRuntime } from "@/services/runtime/use-runtime";
import * as React from "react";

// Wraps protected children. On mount, asks the BFF whether we have a session
// (`GET /auth/me`). On 401, kicks off the OIDC flow by navigating to the
// server's `/auth/login` — server runs the back-channel exchange with Zitadel
// and lands the browser back on the SPA with a session cookie set.
export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const me = AuthQueries.useCurrentUserQuery();
  const runtime = useRuntime();
  const redirectingRef = React.useRef(false);

  React.useEffect(() => {
    if (me.isError && !redirectingRef.current) {
      redirectingRef.current = true;
      void runtime.runPromise(AuthQueries.beginLogin);
    }
  }, [me.isError, runtime]);

  // While we're still resolving auth state — or while the redirect to
  // `/auth/login` is mid-flight — render a blank surface. Avoids flashing
  // misleading copy (e.g. "Signing you in…" briefly visible during a
  // logout's redirect chain).
  if (me.isPending || me.isError) {
    return <main className="min-h-screen bg-background" />;
  }

  return <React.Fragment>{children}</React.Fragment>;
};
