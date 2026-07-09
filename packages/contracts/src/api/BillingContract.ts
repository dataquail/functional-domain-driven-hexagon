import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

import * as CustomHttpApiError from "../CustomHttpApiError.js";
import { OrganizationId, SubscriptionId } from "../EntityIds.js";
import { UserAuthMiddleware } from "../Policy.js";

// ==========================================
// Errors
// ==========================================

export class SubscriptionNotFoundError extends Schema.TaggedErrorClass<SubscriptionNotFoundError>(
  "SubscriptionNotFoundError",
)(
  "SubscriptionNotFoundError",
  { organizationId: OrganizationId, message: Schema.String },
  { httpApiStatus: 404 },
) {}

export class SubscriptionAlreadyExistsError extends Schema.TaggedErrorClass<SubscriptionAlreadyExistsError>(
  "SubscriptionAlreadyExistsError",
)(
  "SubscriptionAlreadyExistsError",
  { organizationId: OrganizationId, message: Schema.String },
  { httpApiStatus: 409 },
) {}

// ==========================================
// Shapes
// ==========================================

// `status` is the literal Stripe subscription status, carried verbatim
// (`active`, `past_due`, `canceled`, `trialing`, `incomplete`, ...). We
// don't collapse the vocabulary — clients render whichever they need.
export class SubscriptionResponse extends Schema.Class<SubscriptionResponse>(
  "SubscriptionResponse",
)({
  id: SubscriptionId,
  organizationId: OrganizationId,
  status: Schema.String,
  currentPeriodEnd: Schema.NullOr(Schema.DateTimeUtc),
}) {}

// MVP: a single default price comes from server config (STRIPE_PRICE_ID_DEFAULT).
// No body fields yet — keep the type around so clients send something parseable.
export class StartSubscriptionPayload extends Schema.Class<StartSubscriptionPayload>(
  "StartSubscriptionPayload",
)({}) {}

// ==========================================
// Endpoints
// ==========================================

// Org-scoped read/mutate. `Authz.hasPermissions(BillingResource, …, orgId)`
// inside each handler — `read` is member-or-super-admin, `update` (subscribe
// + cancel) is org-admin-or-super-admin. The 403 surface is the policy
// denial.
export class PrivateGroup extends HttpApiGroup.make("billing")
  .add(
    HttpApiEndpoint.post("startSubscription", "/:orgId/billing/subscriptions", {
      params: Schema.Struct({ orgId: OrganizationId }),
      payload: StartSubscriptionPayload,
      success: SubscriptionResponse,
      error: [
        CustomHttpApiError.Forbidden,
        CustomHttpApiError.BadGateway,
        SubscriptionAlreadyExistsError,
        CustomHttpApiError.ServiceUnavailable,
      ],
    }),
  )
  .add(
    HttpApiEndpoint.get("getCurrentSubscription", "/:orgId/billing/subscriptions/current", {
      params: Schema.Struct({ orgId: OrganizationId }),
      success: SubscriptionResponse,
      error: [
        CustomHttpApiError.Forbidden,
        SubscriptionNotFoundError,
        CustomHttpApiError.ServiceUnavailable,
      ],
    }),
  )
  .add(
    HttpApiEndpoint.make("DELETE")("cancelSubscription", "/:orgId/billing/subscriptions/current", {
      params: Schema.Struct({ orgId: OrganizationId }),
      success: SubscriptionResponse,
      error: [
        CustomHttpApiError.Forbidden,
        CustomHttpApiError.BadGateway,
        SubscriptionNotFoundError,
        CustomHttpApiError.ServiceUnavailable,
      ],
    }),
  )
  .middleware(UserAuthMiddleware)
  .prefix("/orgs") {}

// Public Stripe webhook ingress. No `UserAuthMiddleware` — the request
// has no session cookie. Authentication is by Stripe-Signature header,
// verified by the BillingGateway. The endpoint opts out of `setPayload`
// because Stripe's `constructEvent` requires the EXACT raw bytes; the
// handler reads `HttpServerRequest.text` itself and parses after
// signature verification.
//
// Returns 200 (Void) on accepted events AND on duplicates (idempotency
// is internal). Returns 401 on bad signature, 503 on persistence failure.
export class PublicGroup extends HttpApiGroup.make("billingWebhooks")
  .add(
    HttpApiEndpoint.post("handleStripeWebhook", "/stripe", {
      success: Schema.Void,
      error: [
        CustomHttpApiError.Unauthorized,
        CustomHttpApiError.BadRequest,
        CustomHttpApiError.ServiceUnavailable,
      ],
    }),
  )
  .prefix("/webhooks") {}
