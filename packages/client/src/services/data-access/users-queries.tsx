import { QueryData, useEffectMutation, useEffectQuery } from "@/lib/tanstack-query";
import { type UserContract } from "@org/contracts/api/Contracts";
import { keepPreviousData } from "@tanstack/react-query";
import * as Effect from "effect/Effect";
import { ApiClient } from "../common/api-client";

export namespace UsersQueries {
  export type ListVariables = { page: number; pageSize: number };

  const usersKey = QueryData.makeQueryKey<"users", ListVariables>("users");
  const usersHelpers = QueryData.makeHelpers<UserContract.PaginatedUsers, ListVariables>(usersKey);

  export const createUser = (payload: UserContract.CreateUserPayload) =>
    Effect.flatMap(ApiClient, ({ client }) => client.user.create({ payload })).pipe(
      Effect.tap(() => usersHelpers.invalidateAllQueries()),
    );

  export const useUsersQuery = (variables: ListVariables) => {
    return useEffectQuery({
      queryKey: usersKey(variables),
      // eslint-disable-next-line react-hooks/rules-of-hooks
      queryFn: () => ApiClient.use(({ client }) => client.user.find({ urlParams: variables })),
      placeholderData: keepPreviousData,
    });
  };

  export const useCreateUserMutation = () => {
    return useEffectMutation({
      mutationKey: ["UsersQueries.createUser"],
      mutationFn: createUser,
      toastifySuccess: () => "User created!",
      toastifyErrors: {
        UserAlreadyExistsError: (error) => error.message,
      },
    });
  };
}
