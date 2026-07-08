import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";
import * as Schema from "effect/Schema";

import * as CustomHttpApiError from "../CustomHttpApiError.js";
import { ApiTokenId, UserId } from "../EntityIds.js";
import { UserAuthMiddleware } from "../Policy.js";

// ==========================================
// Shapes
// ==========================================

export class CurrentUserResponse extends Schema.Class<CurrentUserResponse>("CurrentUserResponse")({
  userId: UserId,
  isSuperAdmin: Schema.Boolean,
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
  // Callback talks to the DB (SignInCommand persists a session). Transient
  // store failure surfaces here as 503 — see UserContract for rationale.
  .addError(CustomHttpApiError.ServiceUnavailable)
  .prefix("/auth") {}

// ==========================================
// Private group: me — UserAuthMiddleware required
// ==========================================

export class PrivateGroup extends HttpApiGroup.make("authSession")
  .middleware(UserAuthMiddleware)
  .add(HttpApiEndpoint.get("me", "/me").addSuccess(CurrentUserResponse))
  // Group-wide 503 surface — see UserContract for rationale.
  .addError(CustomHttpApiError.ServiceUnavailable)
  .prefix("/auth") {}

// ==========================================
// API tokens: GUI-managed personal access tokens (ADR-0024)
// ==========================================

// Owner-facing summary of an active token. Carries no secret — `prefix` is
// the non-secret display fragment shown so an owner can tell tokens apart.
export class ApiTokenSummary extends Schema.Class<ApiTokenSummary>("ApiTokenSummary")({
  id: ApiTokenId,
  label: Schema.String,
  prefix: Schema.String,
  expiresAt: Schema.NullOr(Schema.DateTimeUtc),
  createdAt: Schema.DateTimeUtc,
  lastUsedAt: Schema.DateTimeUtc,
}) {}

export class CreateApiTokenPayload extends Schema.Class<CreateApiTokenPayload>(
  "CreateApiTokenPayload",
)({
  label: Schema.String.pipe(Schema.isMinLength(1), Schema.isMaxLength(255)),
  // Days until the token expires. Optional — the server falls back to its
  // configured default. Capped to keep CI tokens from living forever.
  expiresInDays: Schema.optional(
    Schema.Int.pipe(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(3650)),
  ),
}) {}

// The plaintext `token` is returned exactly once at creation and never again.
export class CreateApiTokenResponse extends Schema.Class<CreateApiTokenResponse>(
  "CreateApiTokenResponse",
)({
  id: ApiTokenId,
  token: Schema.String,
  prefix: Schema.String,
  expiresAt: Schema.NullOr(Schema.DateTimeUtc),
}) {}

export class DeviceApprovalPayload extends Schema.Class<DeviceApprovalPayload>(
  "DeviceApprovalPayload",
)({
  userCode: Schema.String.pipe(Schema.isMinLength(1), Schema.isMaxLength(32)),
}) {}

// Browser-side approval of a CLI device grant (ADR-0024). The signed-in user
// submits the code the CLI showed them; the server binds the grant to them.
// On the GUI surface (the human is in the browser); the CLI's start/poll
// endpoints live on `CliApi`.
export class DeviceApprovalGroup extends HttpApiGroup.make("authDevice")
  .middleware(UserAuthMiddleware)
  .add(
    HttpApiEndpoint.post("approve", "/approve")
      .setPayload(DeviceApprovalPayload)
      .addError(CustomHttpApiError.NotFound)
      .addError(CustomHttpApiError.Gone)
      .addSuccess(Schema.Void),
  )
  .addError(CustomHttpApiError.ServiceUnavailable)
  .prefix("/auth/device") {}

// Token management is a human-in-the-browser concern (a user mints a CI
// token); the CLI/MCP obtain tokens via the device flow or a pre-minted PAT.
// Hence this lives on the GUI `DomainApi`, not the CLI surface (ADR-0024).
export class TokensGroup extends HttpApiGroup.make("authTokens")
  .middleware(UserAuthMiddleware)
  .add(
    HttpApiEndpoint.post("create", "/")
      .setPayload(CreateApiTokenPayload)
      .addSuccess(CreateApiTokenResponse),
  )
  .add(HttpApiEndpoint.get("list", "/").addSuccess(Schema.Array(ApiTokenSummary)))
  .add(
    HttpApiEndpoint.del("revoke", "/:id")
      .setPath(Schema.Struct({ id: ApiTokenId }))
      .addError(CustomHttpApiError.NotFound)
      .addSuccess(Schema.Void),
  )
  .addError(CustomHttpApiError.ServiceUnavailable)
  .prefix("/auth/tokens") {}
