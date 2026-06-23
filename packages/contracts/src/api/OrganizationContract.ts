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
// 409 Conflict: the role grant/revoke contradicts the member's current
// state. `already_admin` surfaces from promote when the member is
// already an admin; `not_admin` from demote when they aren't one. One
// error variant, a `reason` discriminator — same shape as
// `InvitationGoneError`.
export class OrganizationRoleConflictError extends Schema.TaggedError<OrganizationRoleConflictError>(
  "OrganizationRoleConflictError",
)(
  "OrganizationRoleConflictError",
  {
    reason: Schema.Literal("already_admin", "not_admin"),
    message: Schema.String,
  },
  HttpApiSchema.annotations({ status: 409 }),
) {}

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

// The caller's own org as returned by `findMine`. Carries `isAdmin` —
// whether the caller holds the `admin` OrganizationRole here — so the
// frontend can gate admin-only surfaces (Billing / Invite tabs, member
// management) without a separate role probe. Distinct from the shared
// `Organization` shape, which is also returned by the super-admin
// `findAll` listing where "isAdmin relative to whom?" has no answer.
export class MyOrganization extends Schema.Class<MyOrganization>("MyOrganization")({
  id: OrganizationId,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
  deletedAt: Schema.NullOr(Schema.DateTimeUtc),
  isAdmin: Schema.Boolean,
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
  // True when the member holds the `admin` OrganizationRole. Drives the
  // promote/demote affordance in the member-management UI.
  isAdmin: Schema.Boolean,
}) {}

export class OrganizationMembersResponse extends Schema.Class<OrganizationMembersResponse>(
  "OrganizationMembersResponse",
)({
  members: Schema.Array(OrganizationMember),
}) {}

// A still-open invitation (not yet accepted, not revoked) for the
// pending-invitations section of the member-management surface.
// `status` distinguishes a live invite from a lapsed (expired) one so
// the UI can flag the latter for resend. Accepted invitees appear in
// the members list instead; revoked invitations aren't returned.
export class PendingInvitation extends Schema.Class<PendingInvitation>("PendingInvitation")({
  invitationId: InvitationId,
  inviteeEmail: Schema.String,
  status: Schema.Literal("pending", "expired"),
  expiresAt: Schema.DateTimeUtc,
  createdAt: Schema.DateTimeUtc,
}) {}

export class PendingInvitationsResponse extends Schema.Class<PendingInvitationsResponse>(
  "PendingInvitationsResponse",
)({
  invitations: Schema.Array(PendingInvitation),
}) {}

// ==========================================
// Endpoints
// ==========================================

export class Group extends HttpApiGroup.make("organization")
  .middleware(UserAuthMiddleware)
  .add(HttpApiEndpoint.get("findMine", "/").addSuccess(Schema.Array(MyOrganization)))
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
  // Pending-invitations roster for the member-management surface.
  // `update`-gated (org admin OR super-admin) — viewing who has been
  // invited is part of managing invitations, so unlike `findMembers`
  // (member-readable) this stays admin-only.
  .add(
    HttpApiEndpoint.get("findInvitations", "/:orgId/invitations")
      .setPath(Schema.Struct({ orgId: OrganizationId }))
      .addError(CustomHttpApiError.Forbidden)
      .addError(OrganizationNotFoundError)
      .addSuccess(PendingInvitationsResponse),
  )
  // Resend = reissue (fresh token + expiry) + re-send the email. Reissue
  // refuses a terminal invitation, surfaced as 410 Gone like revoke.
  .add(
    HttpApiEndpoint.post("resendInvitation", "/:orgId/invitations/:invitationId/resend")
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
  // Members roster. `read`-gated (`any(SuperAdminOnly, IsMember)`) so
  // any member of the org may view it — managing the roster (promote /
  // demote / remove) stays `update`-gated. Rendered by the org members
  // page (read-only for plain members), the org-admin management UI,
  // and the super-admin drill-in.
  .add(
    HttpApiEndpoint.get("findMembers", "/:orgId/members")
      .setPath(Schema.Struct({ orgId: OrganizationId }))
      .addError(CustomHttpApiError.Forbidden)
      .addError(OrganizationNotFoundError)
      .addSuccess(OrganizationMembersResponse),
  )
  .add(
    HttpApiEndpoint.post("promoteMember", "/:orgId/members/:userId/admin")
      .setPath(Schema.Struct({ orgId: OrganizationId, userId: UserId }))
      .addError(CustomHttpApiError.Forbidden)
      .addError(OrganizationNotFoundError)
      .addError(OrganizationRoleConflictError)
      .addSuccess(Schema.Void),
  )
  .add(
    HttpApiEndpoint.del("demoteMember", "/:orgId/members/:userId/admin")
      .setPath(Schema.Struct({ orgId: OrganizationId, userId: UserId }))
      .addError(CustomHttpApiError.Forbidden)
      .addError(OrganizationNotFoundError)
      .addError(OrganizationRoleConflictError)
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
  // Member listing moved to `Group.findMembers` (`/orgs/:orgId/members`,
  // `read`-gated) so members, org admins, and super-admins share one
  // endpoint via the OR chain.
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
