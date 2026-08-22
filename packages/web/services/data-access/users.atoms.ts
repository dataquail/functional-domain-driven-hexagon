// Users, as the Model sees them: one query atom, one mutation atom, and the
// server-side Effect that feeds the query's hydration.
//
// The request builder is shared between the atom and the prefetch on purpose.
// It is the one thing that could drift between the two paths, and a drift there
// is invisible -- the page would simply refetch on the client and nobody would
// notice the prefetch had stopped landing.

import { UserContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";

import { ApiClient } from "@/services/api-client.shared";
import { ApiAtoms } from "@/services/atom/api-atoms.shared";
import { ReactivityKeys } from "@/services/atom/reactivity-keys";

export type UsersListVariables = {
  readonly page: number;
  readonly pageSize: number;
};

const findUsersRequest = (variables: UsersListVariables) => ({
  query: new UserContract.FindUsersParams(variables),
});

const serializationKey = (variables: UsersListVariables): string =>
  `${variables.page}:${variables.pageSize}`;

export const usersQueryAtom = (variables: UsersListVariables) =>
  ApiAtoms.query("user", "find", {
    ...findUsersRequest(variables),
    reactivityKeys: ReactivityKeys.users,
    serializationKey: serializationKey(variables),
  });

export const fetchUsers = (variables: UsersListVariables) =>
  Effect.flatMap(ApiClient, ({ client }) => client.user.find(findUsersRequest(variables)));

export const createUserAtom = ApiAtoms.mutation("user", "create");
