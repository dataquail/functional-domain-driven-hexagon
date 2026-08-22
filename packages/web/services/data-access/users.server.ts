import "server-only";

import { prefetchQuery } from "@/services/atom/prefetch.server";

import { fetchUsers, type UsersListVariables, usersQueryAtom } from "./users.atoms";

export const prefetchUsers = (variables: UsersListVariables) =>
  prefetchQuery(usersQueryAtom(variables), fetchUsers(variables));
