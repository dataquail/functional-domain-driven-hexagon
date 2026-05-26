import * as HttpApiMiddleware from "@effect/platform/HttpApiMiddleware";
import * as Context from "effect/Context";
import * as Schema from "effect/Schema";

import * as CustomHttpApiError from "./CustomHttpApiError.js";
import { type UserId } from "./EntityIds.js";

// CurrentUser is the per-request identity carried via Effect's
// environment — sessionId + userId, nothing else. Authorization-relevant
// state (platform roles, org memberships, future capability grants)
// lives behind platform-layer ACL services (`RoleService`, …) consumed
// by policies, not on this tag. Endpoints consume it via `yield*
// CurrentUser`; per-route authz decisions go through
// `Authz.hasPermissions(...)` in the server package.
export class CurrentUser extends Context.Tag("CurrentUser")<
  CurrentUser,
  {
    readonly sessionId: string;
    readonly userId: UserId;
  }
>() {}

// The middleware fails with `Unauthorized` for normal auth failures
// (missing/invalid cookie, expired session) and `ServiceUnavailable`
// when the auth store is transiently down. Without the second case in
// the failure union, a DB outage would surface as 401 and trigger a
// client-side re-auth loop instead of a backoff-and-retry 503.
export class UserAuthMiddleware extends HttpApiMiddleware.Tag<UserAuthMiddleware>()(
  "UserAuthMiddleware",
  {
    failure: Schema.Union(CustomHttpApiError.Unauthorized, CustomHttpApiError.ServiceUnavailable),
    provides: CurrentUser,
  },
) {}
