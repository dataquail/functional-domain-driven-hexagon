import "server-only";

import { prefetchQuery } from "@/services/atom/prefetch.server";

import {
  adminOrgsQueryAtom,
  type AdminOrgsVariables,
  fetchAdminOrgs,
  fetchMyOrgs,
  myOrgsQueryAtom,
} from "./orgs.atoms";

export const prefetchMyOrgs = () => prefetchQuery(myOrgsQueryAtom, fetchMyOrgs);

export const prefetchAdminOrgs = (variables: AdminOrgsVariables) =>
  prefetchQuery(adminOrgsQueryAtom(variables), fetchAdminOrgs(variables));
