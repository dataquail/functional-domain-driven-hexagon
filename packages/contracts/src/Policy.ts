import * as Context from "effect/Context";
import * as HttpApiMiddleware from "effect/unstable/httpapi/HttpApiMiddleware";

import * as CustomHttpApiError from "./CustomHttpApiError.js";
import { type UserId } from "./EntityIds.js";

// CurrentUser is the per-request identity carried via Effect's
// environment — sessionId + userId, nothing else. Authorization-relevant
// state (platform roles, org memberships, future capability grants)
// lives behind platform-layer ACL services (`RoleService`, …) consumed
// by policies, not on this tag. Endpoints consume it via `yield*
// CurrentUser`; per-route authz decisions go through
// `Authz.hasPermissions(...)` in the server package.
export class CurrentUser extends Context.Service<
  CurrentUser,
  {
    readonly sessionId: string;
    readonly userId: UserId;
  }
>()("CurrentUser") {}

// The middleware fails with `Unauthorized` for normal auth failures
// (missing/invalid cookie, expired session) and `ServiceUnavailable`
// when the auth store is transiently down. Without the second case in
// the failure union, a DB outage would surface as 401 and trigger a
// client-side re-auth loop instead of a backoff-and-retry 503.
export class UserAuthMiddleware extends HttpApiMiddleware.Service<
  UserAuthMiddleware,
  { provides: CurrentUser }
>()("UserAuthMiddleware", {
  // Declare the errors as an ARRAY, not `Schema.Union([...])`. The
  // middleware stores `error` as a `Set` of individual schemas
  // (`getError` wraps a non-array in a one-element set), and
  // `HttpApiBuilder` reads each member's `httpApiStatus` annotation to
  // pick the response status. A single union schema has no status
  // annotation on its own node, so every auth failure collapses to 500
  // (the `getStatusError` fallback) — e.g. `/auth/me` returns 500 instead
  // of 401. Passing the array keeps each error's status (401 / 503).
  error: [CustomHttpApiError.Unauthorized, CustomHttpApiError.ServiceUnavailable],
}) {}
