import "server-only";

import type { OrganizationId } from "@org/contracts/EntityIds";

import { prefetchQuery } from "@/services/atom/prefetch.server";

import {
  fetchOrgInvitations,
  fetchOrgMembers,
  orgInvitationsQueryAtom,
  orgMembersQueryAtom,
} from "./org-members.atoms";

export const prefetchOrgMembers = (orgId: OrganizationId) =>
  prefetchQuery(orgMembersQueryAtom(orgId), fetchOrgMembers(orgId));

export const prefetchOrgInvitations = (orgId: OrganizationId) =>
  prefetchQuery(orgInvitationsQueryAtom(orgId), fetchOrgInvitations(orgId));
