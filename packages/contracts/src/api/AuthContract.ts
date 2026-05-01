import * as HttpApiEndpoint from "@effect/platform/HttpApiEndpoint";
import * as HttpApiGroup from "@effect/platform/HttpApiGroup";
import * as Schema from "effect/Schema";
import * as CustomHttpApiError from "../CustomHttpApiError.js";
import { UserId } from "../EntityIds.js";
import { Permission, UserAuthMiddleware } from "../Policy.js";

// ==========================================
// Shapes
// ==========================================

export class CurrentUserResponse extends Schema.Class<CurrentUserResponse>("CurrentUserResponse")({
  userId: UserId,
  permissions: Schema.Array(Permission),
}) {}

export class CallbackParams extends Schema.Class<CallbackParams>("CallbackParams")({
  code: Schema.optional(Schema.String),
  state: Schema.optional(Schema.String),
  error: Schema.optional(Schema.String),
  error_description: Schema.optional(Schema.String),
}) {}

// ==========================================
// Public group: login + callback (no middleware — user has no session yet)
// ==========================================

export class PublicGroup extends HttpApiGroup.make("auth")
  .add(
    HttpApiEndpoint.get("login", "/login")
      .addSuccess(Schema.Void)
      .addError(CustomHttpApiError.InternalServerError),
  )
  .add(
    HttpApiEndpoint.get("callback", "/callback")
      .setUrlParams(CallbackParams)
      .addSuccess(Schema.Void)
      .addError(CustomHttpApiError.Unauthorized)
      .addError(CustomHttpApiError.InternalServerError),
  )
  // GET (idempotent, no body): server reads our session cookie inline, revokes
  // the row if present, clears the cookie, and 302s to Zitadel's
  // end_session_endpoint so the SSO cookie is also torn down. Public so it
  // works even when our session is already gone (e.g., expired) — logout
  // must always succeed.
  .add(
    HttpApiEndpoint.get("logout", "/logout")
      .addSuccess(Schema.Void)
      .addError(CustomHttpApiError.InternalServerError),
  )
  .prefix("/auth") {}

// ==========================================
// Private group: me — UserAuthMiddleware required
// ==========================================

export class PrivateGroup extends HttpApiGroup.make("authSession")
  .middleware(UserAuthMiddleware)
  .add(HttpApiEndpoint.get("me", "/me").addSuccess(CurrentUserResponse))
  .prefix("/auth") {}
