// Organization fixtures for the integration tier. Each factory returns a
// contract-shape object with sensible defaults so tests can override only the
// fields they care about. The drift gate is the sibling test: each fixture's
// default output must decode through the contract's response schema.

import * as OrganizationContract from "@org/contracts/api/OrganizationContract";
import { InvitationId, OrganizationId, UserId } from "@org/contracts/EntityIds";
import * as DateTime from "effect/DateTime";

const FIXED_DATE = DateTime.makeUnsafe(new Date("2026-01-01T00:00:00Z"));

export const ORG_A_ID = OrganizationId.make("11111111-1111-1111-1111-111111111111");
export const ORG_B_ID = OrganizationId.make("22222222-2222-2222-2222-222222222222");

/** A valid `MyOrganization` — the shape `findMine` returns. */
export const makeMyOrganization = (
  overrides: Partial<OrganizationContract.MyOrganization> = {},
): OrganizationContract.MyOrganization =>
  new OrganizationContract.MyOrganization({
    id: ORG_A_ID,
    name: "Org A",
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    deletedAt: null,
    isAdmin: true,
    ...overrides,
  });

/** A valid `CreateOrganizationPayload` — the shape the create form submits. */
export const makeCreateOrganizationPayload = (
  overrides: Partial<OrganizationContract.CreateOrganizationPayload> = {},
): OrganizationContract.CreateOrganizationPayload =>
  new OrganizationContract.CreateOrganizationPayload({
    name: "Acme Inc.",
    ...overrides,
  });

/** A row of the super-admin `findAll` listing. */
export const makeOrganization = (
  overrides: Partial<OrganizationContract.Organization> = {},
): OrganizationContract.Organization =>
  new OrganizationContract.Organization({
    id: ORG_A_ID,
    name: "Org A",
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    deletedAt: null,
    ...overrides,
  });

/** A page of the super-admin `findAll` listing; `organizations` defaults to one. */
export const makePaginatedOrganizations = (
  overrides: Partial<OrganizationContract.PaginatedOrganizations> = {},
): OrganizationContract.PaginatedOrganizations => {
  const organizations = overrides.organizations ?? [makeOrganization()];
  return new OrganizationContract.PaginatedOrganizations({
    organizations,
    page: 1,
    pageSize: 10,
    total: organizations.length,
    ...overrides,
  });
};

/** A member row of the org roster. */
export const makeOrganizationMember = (
  overrides: Partial<OrganizationContract.OrganizationMember> = {},
): OrganizationContract.OrganizationMember =>
  new OrganizationContract.OrganizationMember({
    userId: UserId.make("11111111-1111-1111-1111-111111111111"),
    email: "alice@example.com",
    joinedAt: FIXED_DATE,
    isAdmin: false,
    ...overrides,
  });

/** An open invitation for the pending-invitations section. */
export const makePendingInvitation = (
  overrides: Partial<OrganizationContract.PendingInvitation> = {},
): OrganizationContract.PendingInvitation =>
  new OrganizationContract.PendingInvitation({
    invitationId: InvitationId.make("77777777-7777-7777-7777-777777777777"),
    inviteeEmail: "invitee@example.com",
    status: "pending",
    expiresAt: FIXED_DATE,
    createdAt: FIXED_DATE,
    ...overrides,
  });
