import * as HttpApiEndpoint from "@effect/platform/HttpApiEndpoint";
import * as HttpApiGroup from "@effect/platform/HttpApiGroup";
import * as HttpApiSchema from "@effect/platform/HttpApiSchema";
import * as Schema from "effect/Schema";

import * as CustomHttpApiError from "../CustomHttpApiError.js";
import { OrganizationId, SubscriptionId } from "../EntityIds.js";
import { UserAuthMiddleware } from "../Policy.js";

// ==========================================
// Errors
// ==========================================

export class SubscriptionNotFoundError extends Schema.TaggedError<SubscriptionNotFoundError>(
  "SubscriptionNotFoundError",
)(
  "SubscriptionNotFoundError",
  { organizationId: OrganizationId, message: Schema.String },
  HttpApiSchema.annotations({ status: 404 }),
) {}

export class SubscriptionAlreadyExistsError extends Schema.TaggedError<SubscriptionAlreadyExistsError>(
  "SubscriptionAlreadyExistsError",
)(
  "SubscriptionAlreadyExistsError",
  { organizationId: OrganizationId, message: Schema.String },
  HttpApiSchema.annotations({ status: 409 }),
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
  .middleware(UserAuthMiddleware)
  .add(
    HttpApiEndpoint.post("startSubscription", "/:orgId/billing/subscriptions")
      .setPath(Schema.Struct({ orgId: OrganizationId }))
      .setPayload(StartSubscriptionPayload)
      .addError(CustomHttpApiError.Forbidden)
      .addError(CustomHttpApiError.BadGateway)
      .addError(SubscriptionAlreadyExistsError)
      .addSuccess(SubscriptionResponse),
  )
  .add(
    HttpApiEndpoint.get("getCurrentSubscription", "/:orgId/billing/subscriptions/current")
      .setPath(Schema.Struct({ orgId: OrganizationId }))
      .addError(CustomHttpApiError.Forbidden)
      .addError(SubscriptionNotFoundError)
      .addSuccess(SubscriptionResponse),
  )
  .add(
    HttpApiEndpoint.del("cancelSubscription", "/:orgId/billing/subscriptions/current")
      .setPath(Schema.Struct({ orgId: OrganizationId }))
      .addError(CustomHttpApiError.Forbidden)
      .addError(CustomHttpApiError.BadGateway)
      .addError(SubscriptionNotFoundError)
      .addSuccess(SubscriptionResponse),
  )
  .addError(CustomHttpApiError.ServiceUnavailable)
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
    HttpApiEndpoint.post("handleStripeWebhook", "/stripe")
      .addError(CustomHttpApiError.Unauthorized)
      .addError(CustomHttpApiError.BadRequest)
      .addSuccess(Schema.Void),
  )
  .addError(CustomHttpApiError.ServiceUnavailable)
  .prefix("/webhooks") {}
