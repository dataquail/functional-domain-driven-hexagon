import * as HttpApiEndpoint from "@effect/platform/HttpApiEndpoint";
import * as HttpApiGroup from "@effect/platform/HttpApiGroup";
import * as HttpApiSchema from "@effect/platform/HttpApiSchema";
import * as Schema from "effect/Schema";

import * as CustomHttpApiError from "../CustomHttpApiError.js";
import { InvitationId, OrganizationId, UserId } from "../EntityIds.js";
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

export class InvitationNotFoundError extends Schema.TaggedError<InvitationNotFoundError>(
  "InvitationNotFoundError",
)(
  "InvitationNotFoundError",
  { message: Schema.String },
  HttpApiSchema.annotations({ status: 404 }),
) {}

// 410 Gone covers the three terminal/expired states (accepted, revoked,
// expired). Clients see one error variant; the `reason` discriminates
// so a UI can render the right message.
export class InvitationGoneError extends Schema.TaggedError<InvitationGoneError>(
  "InvitationGoneError",
)(
  "InvitationGoneError",
  {
    reason: Schema.Literal("accepted", "revoked", "expired"),
    message: Schema.String,
  },
  HttpApiSchema.annotations({ status: 410 }),
) {}

export class MembershipNotFoundError extends Schema.TaggedError<MembershipNotFoundError>(
  "MembershipNotFoundError",
)(
  "MembershipNotFoundError",
  { message: Schema.String },
  HttpApiSchema.annotations({ status: 404 }),
) {}

// 409 Conflict: model invariant — super-admins are a separate user
// type from regular users; they don't own or join organizations.
// Surfaces from `create` and `accept` when the caller's platform role
// is `super_admin`.
export class SuperAdminCannotOwnOrganizationError extends Schema.TaggedError<SuperAdminCannotOwnOrganizationError>(
  "SuperAdminCannotOwnOrganizationError",
)(
  "SuperAdminCannotOwnOrganizationError",
  { message: Schema.String },
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

export class InviteUserPayload extends Schema.Class<InviteUserPayload>("InviteUserPayload")({
  email: Schema.String.pipe(Schema.minLength(3), Schema.maxLength(320)),
}) {}

export class InviteUserResponse extends Schema.Class<InviteUserResponse>("InviteUserResponse")({
  invitationId: InvitationId,
}) {}

export class AcceptInvitationResponse extends Schema.Class<AcceptInvitationResponse>(
  "AcceptInvitationResponse",
)({
  organizationId: OrganizationId,
}) {}

// Joined view returned by the SA admin "list members of org" endpoint.
// The handler composes the org-module's membership query with the
// user-module's `FindUsersByIdsQuery` (ADR-0021 forbids cross-schema
// SQL) — both are reads, so no transactional concern.
export class OrganizationMember extends Schema.Class<OrganizationMember>("OrganizationMember")({
  userId: UserId,
  email: Schema.String,
  joinedAt: Schema.DateTimeUtc,
}) {}

export class OrganizationMembersResponse extends Schema.Class<OrganizationMembersResponse>(
  "OrganizationMembersResponse",
)({
  members: Schema.Array(OrganizationMember),
}) {}

// ==========================================
// Endpoints
// ==========================================

export class Group extends HttpApiGroup.make("organization")
  .middleware(UserAuthMiddleware)
  .add(HttpApiEndpoint.get("findMine", "/").addSuccess(Schema.Array(Organization)))
  .add(
    HttpApiEndpoint.post("create", "/")
      .setPayload(CreateOrganizationPayload)
      .addError(SuperAdminCannotOwnOrganizationError)
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
  .add(
    HttpApiEndpoint.post("inviteUser", "/:orgId/invitations")
      .setPath(Schema.Struct({ orgId: OrganizationId }))
      .setPayload(InviteUserPayload)
      .addError(CustomHttpApiError.Forbidden)
      .addError(OrganizationNotFoundError)
      .addSuccess(InviteUserResponse),
  )
  .add(
    HttpApiEndpoint.del("revokeInvitation", "/:orgId/invitations/:invitationId")
      .setPath(Schema.Struct({ orgId: OrganizationId, invitationId: InvitationId }))
      .addError(CustomHttpApiError.Forbidden)
      .addError(OrganizationNotFoundError)
      .addError(InvitationNotFoundError)
      .addError(InvitationGoneError)
      .addSuccess(Schema.Void),
  )
  .add(
    HttpApiEndpoint.del("removeMember", "/:orgId/members/:userId")
      .setPath(Schema.Struct({ orgId: OrganizationId, userId: UserId }))
      .addError(CustomHttpApiError.Forbidden)
      .addError(OrganizationNotFoundError)
      .addError(MembershipNotFoundError)
      .addSuccess(Schema.Void),
  )
  .add(
    HttpApiEndpoint.post("leave", "/:orgId/leave")
      .setPath(Schema.Struct({ orgId: OrganizationId }))
      .addError(MembershipNotFoundError)
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
  // Super-admin drill-in: list the members of a specific org, joined
  // with each user's email. Reuses the regular `removeMember` /
  // `inviteUser` endpoints on `Group` for write actions (their
  // policies already let super-admins through via the OR chain).
  .add(
    HttpApiEndpoint.get("findMembers", "/:orgId/members")
      .setPath(Schema.Struct({ orgId: OrganizationId }))
      .addError(CustomHttpApiError.Forbidden)
      .addError(OrganizationNotFoundError)
      .addSuccess(OrganizationMembersResponse),
  )
  .addError(CustomHttpApiError.ServiceUnavailable)
  .prefix("/admin/orgs") {}

// The accept endpoint sits OUTSIDE the org/admin groups because the
// caller doesn't yet have a membership and the URL is token-shaped,
// not org-shaped. Still authenticated (the membership row is keyed
// to CurrentUser.userId), no `Authz.hasPermissions` check beyond that
// — the token IS the authorization.
export class InvitationGroup extends HttpApiGroup.make("invitations")
  .middleware(UserAuthMiddleware)
  .add(
    HttpApiEndpoint.post("accept", "/:token/accept")
      .setPath(Schema.Struct({ token: Schema.String }))
      .addError(InvitationNotFoundError)
      .addError(InvitationGoneError)
      .addError(SuperAdminCannotOwnOrganizationError)
      .addSuccess(AcceptInvitationResponse),
  )
  .addError(CustomHttpApiError.ServiceUnavailable)
  .prefix("/invitations") {}
