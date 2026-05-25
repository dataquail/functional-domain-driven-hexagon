import * as HttpApiEndpoint from "@effect/platform/HttpApiEndpoint";
import * as HttpApiGroup from "@effect/platform/HttpApiGroup";
import * as HttpApiSchema from "@effect/platform/HttpApiSchema";
import * as Schema from "effect/Schema";

import * as CustomHttpApiError from "../CustomHttpApiError.js";
import { OrganizationId } from "../EntityIds.js";
import { UserAuthMiddleware } from "../Policy.js";

// ==========================================
// Errors
// ==========================================

export class OrganizationNotFoundError extends Schema.TaggedError<OrganizationNotFoundError>(
  "OrganizationNotFoundError",
)(
  "OrganizationNotFoundError",
  { organizationId: OrganizationId, message: Schema.String },
  HttpApiSchema.annotations({ status: 404 }),
) {}

// 409 Conflict: the request was understood and authorized but the
// resource's current state contradicts it (restore on a non-deleted
// org). Distinct status from `OrganizationNotFoundError` so clients
// don't have to disambiguate "missing" vs. "wrong state."
export class OrganizationNotDeletedError extends Schema.TaggedError<OrganizationNotDeletedError>(
  "OrganizationNotDeletedError",
)(
  "OrganizationNotDeletedError",
  { organizationId: OrganizationId, message: Schema.String },
  HttpApiSchema.annotations({ status: 409 }),
) {}

// ==========================================
// Shapes
// ==========================================

export class Organization extends Schema.Class<Organization>("Organization")({
  id: OrganizationId,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
  deletedAt: Schema.NullOr(Schema.DateTimeUtc),
}) {}

// ==========================================
// Payloads / Responses
// ==========================================

export class CreateOrganizationPayload extends Schema.Class<CreateOrganizationPayload>(
  "CreateOrganizationPayload",
)({
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(255)),
}) {}

export class CreateOrganizationResponse extends Schema.Class<CreateOrganizationResponse>(
  "CreateOrganizationResponse",
)({
  id: OrganizationId,
}) {}

export class FindAllOrganizationsParams extends Schema.Class<FindAllOrganizationsParams>(
  "FindAllOrganizationsParams",
)({
  page: Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1)),
  pageSize: Schema.NumberFromString.pipe(Schema.int(), Schema.between(1, 100)),
  // Comma-separated booleans are awkward; default false (active-only)
  // is the common case so the param is optional. Clients flip the
  // recycling-bin view on by passing `includeDeleted=true`.
  includeDeleted: Schema.optional(Schema.Literal("true", "false")),
}) {}

export class PaginatedOrganizations extends Schema.Class<PaginatedOrganizations>(
  "PaginatedOrganizations",
)({
  organizations: Schema.Array(Organization),
  page: Schema.Number,
  pageSize: Schema.Number,
  total: Schema.Number,
}) {}

// ==========================================
// Endpoints
// ==========================================

export class Group extends HttpApiGroup.make("organization")
  .middleware(UserAuthMiddleware)
  .add(
    HttpApiEndpoint.post("create", "/")
      .setPayload(CreateOrganizationPayload)
      .addSuccess(CreateOrganizationResponse),
  )
  .add(
    HttpApiEndpoint.del("softDelete", "/:id")
      .setPath(Schema.Struct({ id: OrganizationId }))
      .addError(CustomHttpApiError.Forbidden)
      .addError(OrganizationNotFoundError)
      .addSuccess(Schema.Void),
  )
  .add(
    HttpApiEndpoint.post("restore", "/:id/restore")
      .setPath(Schema.Struct({ id: OrganizationId }))
      .addError(CustomHttpApiError.Forbidden)
      .addError(OrganizationNotFoundError)
      .addError(OrganizationNotDeletedError)
      .addSuccess(Schema.Void),
  )
  .addError(CustomHttpApiError.ServiceUnavailable)
  .prefix("/orgs") {}

// Admin-only listing of every org (including soft-deleted via the
// `includeDeleted` flag). The 403 surface is the policy denial from
// `Authz.hasPermissions(OrganizationResource, Actions.Read)`; super-
// admins pass and members get rejected — same composition shape as
// the user-module super-admin endpoints.
export class AdminGroup extends HttpApiGroup.make("organizationAdmin")
  .middleware(UserAuthMiddleware)
  .add(
    HttpApiEndpoint.get("findAll", "/")
      .setUrlParams(FindAllOrganizationsParams)
      .addError(CustomHttpApiError.Forbidden)
      .addSuccess(PaginatedOrganizations),
  )
  .addError(CustomHttpApiError.ServiceUnavailable)
  .prefix("/admin/orgs") {}
