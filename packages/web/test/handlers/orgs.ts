// Per-feature MSW handler builders for the Organization contract. Tests
// compose these per-scenario via `server.use(...)`. No shared state;
// each handler returns exactly what the test asks for.

import * as OrganizationContract from "@org/contracts/api/OrganizationContract";
import type { OrganizationId } from "@org/contracts/EntityIds";
import * as Effect from "effect/Effect";

import {
  makePaginatedOrganizations,
  makePendingInvitation,
  ORG_A_ID,
} from "../fixtures/organization";
import { getEndpoint, typedHandler } from "../typed-handler";

const findMineEndpoint = getEndpoint(OrganizationContract.Group, "findMine");
const createEndpoint = getEndpoint(OrganizationContract.Group, "create");
const findAllEndpoint = getEndpoint(OrganizationContract.AdminGroup, "findAll");
const softDeleteEndpoint = getEndpoint(OrganizationContract.Group, "softDelete");
const restoreEndpoint = getEndpoint(OrganizationContract.Group, "restore");
const findMembersEndpoint = getEndpoint(OrganizationContract.Group, "findMembers");
const findInvitationsEndpoint = getEndpoint(OrganizationContract.Group, "findInvitations");
const removeMemberEndpoint = getEndpoint(OrganizationContract.Group, "removeMember");
const promoteMemberEndpoint = getEndpoint(OrganizationContract.Group, "promoteMember");
const demoteMemberEndpoint = getEndpoint(OrganizationContract.Group, "demoteMember");
const resendInvitationEndpoint = getEndpoint(OrganizationContract.Group, "resendInvitation");
const revokeInvitationEndpoint = getEndpoint(OrganizationContract.Group, "revokeInvitation");
const inviteUserEndpoint = getEndpoint(OrganizationContract.Group, "inviteUser");

const notFound = () =>
  Effect.fail(
    new OrganizationContract.OrganizationNotFoundError({
      organizationId: ORG_A_ID,
      message: "Org not found.",
    }),
  );

export const orgsHandlers = {
  /** GET /orgs — the caller's memberships. */
  findMine: (orgs: ReadonlyArray<OrganizationContract.MyOrganization> = []) =>
    typedHandler(findMineEndpoint, () => Effect.succeed(orgs)),

  /** POST /orgs — returns the id of the org the caller just created. */
  create: (
    outcome:
      | { readonly result: "success"; readonly id?: OrganizationId }
      | { readonly result: "SuperAdminCannotOwnOrganizationError" } = { result: "success" },
  ) =>
    typedHandler(createEndpoint, () => {
      if (outcome.result === "SuperAdminCannotOwnOrganizationError") {
        return Effect.fail(
          new OrganizationContract.SuperAdminCannotOwnOrganizationError({
            message: "Super-admins cannot own organizations.",
          }),
        );
      }
      return Effect.succeed(
        new OrganizationContract.CreateOrganizationResponse({ id: outcome.id ?? ORG_A_ID }),
      );
    }),

  /** GET /admin/orgs — the platform-wide listing. */
  findAll: (
    arg:
      | ReadonlyArray<OrganizationContract.Organization>
      | OrganizationContract.PaginatedOrganizations = [],
  ) =>
    typedHandler(findAllEndpoint, ({ urlParams }) =>
      Effect.succeed(
        arg instanceof OrganizationContract.PaginatedOrganizations
          ? arg
          : makePaginatedOrganizations({
              organizations: arg,
              page: urlParams.page,
              pageSize: urlParams.pageSize,
              total: arg.length,
            }),
      ),
    ),

  softDelete: (
    outcome: { readonly result: "success" | "OrganizationNotFoundError" } = { result: "success" },
  ) =>
    typedHandler(softDeleteEndpoint, () =>
      outcome.result === "success" ? Effect.void : notFound(),
    ),

  restore: (
    outcome: { readonly result: "success" | "OrganizationNotDeletedError" } = { result: "success" },
  ) =>
    typedHandler(restoreEndpoint, () =>
      outcome.result === "success"
        ? Effect.void
        : Effect.fail(
            new OrganizationContract.OrganizationNotDeletedError({
              organizationId: ORG_A_ID,
              message: "Organization is not deleted.",
            }),
          ),
    ),

  /** GET /orgs/:orgId/members — the roster. */
  findMembers: (members: ReadonlyArray<OrganizationContract.OrganizationMember> = []) =>
    typedHandler(findMembersEndpoint, () =>
      Effect.succeed(new OrganizationContract.OrganizationMembersResponse({ members })),
    ),

  /** GET /orgs/:orgId/invitations — the open invitations. */
  findInvitations: (invitations: ReadonlyArray<OrganizationContract.PendingInvitation> = []) =>
    typedHandler(findInvitationsEndpoint, () =>
      Effect.succeed(new OrganizationContract.PendingInvitationsResponse({ invitations })),
    ),

  removeMember: (
    outcome: { readonly result: "success" | "MembershipNotFoundError" } = { result: "success" },
  ) =>
    typedHandler(removeMemberEndpoint, () =>
      outcome.result === "success"
        ? Effect.void
        : Effect.fail(
            new OrganizationContract.MembershipNotFoundError({ message: "Not a member." }),
          ),
    ),

  promoteMember: (
    outcome: { readonly result: "success" | "OrganizationRoleConflictError" } = {
      result: "success",
    },
  ) =>
    typedHandler(promoteMemberEndpoint, () =>
      outcome.result === "success"
        ? Effect.void
        : Effect.fail(
            new OrganizationContract.OrganizationRoleConflictError({
              reason: "already_admin",
              message: "Already an admin.",
            }),
          ),
    ),

  demoteMember: (
    outcome: { readonly result: "success" | "OrganizationRoleConflictError" } = {
      result: "success",
    },
  ) =>
    typedHandler(demoteMemberEndpoint, () =>
      outcome.result === "success"
        ? Effect.void
        : Effect.fail(
            new OrganizationContract.OrganizationRoleConflictError({
              reason: "not_admin",
              message: "Not an admin.",
            }),
          ),
    ),

  resendInvitation: (
    outcome: { readonly result: "success" | "InvitationGoneError" } = { result: "success" },
  ) =>
    typedHandler(resendInvitationEndpoint, () =>
      outcome.result === "success"
        ? Effect.void
        : Effect.fail(
            new OrganizationContract.InvitationGoneError({
              reason: "expired",
              message: "Invitation is closed.",
            }),
          ),
    ),

  revokeInvitation: (
    outcome: { readonly result: "success" | "InvitationNotFoundError" } = { result: "success" },
  ) =>
    typedHandler(revokeInvitationEndpoint, () =>
      outcome.result === "success"
        ? Effect.void
        : Effect.fail(
            new OrganizationContract.InvitationNotFoundError({ message: "Invitation not found." }),
          ),
    ),

  /** POST /orgs/:orgId/invitations — invite by email. */
  inviteUser: (
    outcome: { readonly result: "success" | "OrganizationNotFoundError" } = { result: "success" },
  ) =>
    typedHandler(inviteUserEndpoint, () =>
      outcome.result === "success"
        ? Effect.succeed(
            new OrganizationContract.InviteUserResponse({
              invitationId: makePendingInvitation().invitationId,
            }),
          )
        : notFound(),
    ),
};
