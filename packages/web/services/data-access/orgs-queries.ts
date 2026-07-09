// Organization data-access. Server-safe Effects only — pages prefetch
// via the server-only sibling (`orgs-queries.server.ts`); the client
// hook layer in `use-orgs-queries.ts` wraps these with suspense + mutation.
//
// Two query namespaces: `orgs-mine` keys the caller's own membership
// list (used by the nav switcher + root picker), `orgs-admin` keys the
// super-admin "all orgs" list. Mutations invalidate the namespaces the
// write affects.

import { OrganizationContract } from "@org/contracts/api/Contracts";
import type { InvitationId, OrganizationId, UserId } from "@org/contracts/EntityIds";
import * as Effect from "effect/Effect";

import { QueryData } from "@/lib/tanstack-query";
import { ApiClient } from "@/services/api-client.shared";

// ─── findMine ──────────────────────────────────────────────────────────

const myOrgsKey = QueryData.makeQueryKey<"orgs-mine">("orgs-mine");
const myOrgsHelpers =
  QueryData.makeHelpers<ReadonlyArray<OrganizationContract.Organization>>(myOrgsKey);

export const myOrgsQueryKey = myOrgsKey;

export const myOrgsQuery = Effect.flatMap(ApiClient, ({ client }) =>
  client.organization.findMine(),
);

// ─── findAll (admin) ──────────────────────────────────────────────────

export type AdminOrgsVariables = {
  readonly page: number;
  readonly pageSize: number;
  readonly includeDeleted: "true" | "false";
};

const adminOrgsKey = QueryData.makeQueryKey<"orgs-admin", AdminOrgsVariables>("orgs-admin");
const adminOrgsHelpers = QueryData.makeHelpers<
  OrganizationContract.PaginatedOrganizations,
  AdminOrgsVariables
>(adminOrgsKey);

export const adminOrgsQueryKey = adminOrgsKey;

export const adminOrgsQuery = (variables: AdminOrgsVariables) =>
  Effect.flatMap(ApiClient, ({ client }) =>
    client.organizationAdmin.findAll({
      query: new OrganizationContract.FindAllOrganizationsParams(variables),
    }),
  );

// ─── create ───────────────────────────────────────────────────────────

export const createOrganization = (payload: OrganizationContract.CreateOrganizationPayload) =>
  Effect.flatMap(ApiClient, ({ client }) =>
    client.organization.create({
      payload: new OrganizationContract.CreateOrganizationPayload(payload),
    }),
  ).pipe(Effect.tap(() => myOrgsHelpers.invalidateAllQueries()));

// ─── softDelete / restore (admin) ────────────────────────────────────

export const softDeleteOrganization = (args: { readonly id: OrganizationId }) =>
  Effect.flatMap(ApiClient, ({ client }) =>
    client.organization.softDelete({ params: { id: args.id } }),
  ).pipe(
    Effect.tap(() => adminOrgsHelpers.invalidateAllQueries()),
    Effect.tap(() => myOrgsHelpers.invalidateAllQueries()),
  );

export const restoreOrganization = (args: { readonly id: OrganizationId }) =>
  Effect.flatMap(ApiClient, ({ client }) =>
    client.organization.restore({ params: { id: args.id } }),
  ).pipe(
    Effect.tap(() => adminOrgsHelpers.invalidateAllQueries()),
    Effect.tap(() => myOrgsHelpers.invalidateAllQueries()),
  );

// ─── invitations ──────────────────────────────────────────────────────

export const inviteUser = (args: {
  readonly orgId: OrganizationId;
  readonly payload: OrganizationContract.InviteUserPayload;
}) =>
  Effect.flatMap(ApiClient, ({ client }) =>
    client.organization.inviteUser({
      params: { orgId: args.orgId },
      payload: new OrganizationContract.InviteUserPayload(args.payload),
    }),
  );

export const revokeInvitation = (args: {
  readonly orgId: OrganizationId;
  readonly invitationId: InvitationId;
}) =>
  Effect.flatMap(ApiClient, ({ client }) =>
    client.organization.revokeInvitation({
      params: { orgId: args.orgId, invitationId: args.invitationId },
    }),
  );

export const acceptInvitation = (args: { readonly token: string }) =>
  Effect.flatMap(ApiClient, ({ client }) =>
    client.invitations.accept({ params: { token: args.token } }),
  ).pipe(Effect.tap(() => myOrgsHelpers.invalidateAllQueries()));

// ─── membership ───────────────────────────────────────────────────────

export const removeMember = (args: { readonly orgId: OrganizationId; readonly userId: UserId }) =>
  Effect.flatMap(ApiClient, ({ client }) =>
    client.organization.removeMember({ params: { orgId: args.orgId, userId: args.userId } }),
  );

export const leaveOrganization = (args: { readonly orgId: OrganizationId }) =>
  Effect.flatMap(ApiClient, ({ client }) =>
    client.organization.leave({ params: { orgId: args.orgId } }),
  ).pipe(Effect.tap(() => myOrgsHelpers.invalidateAllQueries()));
