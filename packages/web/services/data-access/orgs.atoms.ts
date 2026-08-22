// Organizations, as the Model sees them.
//
// `findMine` is the caller's membership list. It is read by two features on
// screen at once -- the nav switcher and the root picker -- and both reach the
// same atom, so one fetch and one hydration entry serve both.
//
// The admin listing is a separate atom family with its own reactivity key.
// A soft-delete dirties both keys: it changes what the platform listing shows
// *and* what the deleted org's members see in their own switcher.

import { OrganizationContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";

import { ApiClient } from "@/services/api-client.shared";
import { ApiAtoms } from "@/services/atom/api-atoms.shared";
import { ReactivityKeys } from "@/services/atom/reactivity-keys";

export const myOrgsQueryAtom = ApiAtoms.query("organization", "findMine", {
  reactivityKeys: ReactivityKeys.organizations,
  serializationKey: "mine",
});

export const fetchMyOrgs = Effect.flatMap(ApiClient, ({ client }) =>
  client.organization.findMine(),
);

export const createOrgAtom = ApiAtoms.mutation("organization", "create");

export type AdminOrgsVariables = {
  readonly page: number;
  readonly pageSize: number;
  readonly includeDeleted: "true" | "false";
};

const adminOrgsRequest = (variables: AdminOrgsVariables) => ({
  query: new OrganizationContract.FindAllOrganizationsParams(variables),
});

export const adminOrgsQueryAtom = (variables: AdminOrgsVariables) =>
  ApiAtoms.query("organizationAdmin", "findAll", {
    ...adminOrgsRequest(variables),
    reactivityKeys: ReactivityKeys.adminOrganizations,
    serializationKey: `${variables.page}:${variables.pageSize}:${variables.includeDeleted}`,
  });

export const fetchAdminOrgs = (variables: AdminOrgsVariables) =>
  Effect.flatMap(ApiClient, ({ client }) =>
    client.organizationAdmin.findAll(adminOrgsRequest(variables)),
  );

export const softDeleteOrgAtom = ApiAtoms.mutation("organization", "softDelete");
export const restoreOrgAtom = ApiAtoms.mutation("organization", "restore");

// The accept endpoint sits outside the org group: the caller has no membership
// yet and the URL is token-shaped, not org-shaped. Accepting adds a membership,
// so it dirties the caller's own list.
export const acceptInvitationAtom = ApiAtoms.mutation("invitations", "accept");
