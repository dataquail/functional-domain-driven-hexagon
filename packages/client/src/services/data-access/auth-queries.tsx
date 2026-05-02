import { QueryData, useEffectQuery } from "@/lib/tanstack-query";
import { type AuthContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";
import { ApiClient } from "../common/api-client";

export namespace AuthQueries {
  const meKey = QueryData.makeQueryKey<"auth-me", void>("auth-me");

  // Drives `window.location.assign` through Effect so the route guard can
  // dispatch it with the same wrapping the rest of the app uses.
  export const beginLogin = Effect.sync(() => {
    window.location.assign("/auth/login");
  });

  // Logout is a server-mediated redirect chain (our /auth/logout → Zitadel
  // end_session → app root). No mutation is needed — a single navigation
  // tears down both our session cookie and Zitadel's SSO cookie.
  export const beginLogout = Effect.sync(() => {
    window.location.assign("/auth/logout");
  });

  export const useCurrentUserQuery = () =>
    useEffectQuery({
      queryKey: meKey(),
      // eslint-disable-next-line react-hooks/rules-of-hooks
      queryFn: () => ApiClient.use(({ client }) => client.authSession.me()),
      staleTime: "5 minutes",
      // 401 here is the *signal* that drives the redirect to /auth/login —
      // not a user-facing error. Suppress the default toast.
      toastifyErrors: { orElse: false },
      toastifyDefects: false,
    });
}

// Helper kept on the namespace's response type for consumers that want it.
export type CurrentUser = AuthContract.CurrentUserResponse;
