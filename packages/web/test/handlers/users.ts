// Per-feature MSW handler builders for the User contract. Tests
// compose these per-scenario via `server.use(...)`. No shared state;
// each handler returns exactly what the test asks for.

import * as UserContract from "@org/contracts/api/UserContract";
import type { UserId } from "@org/contracts/EntityIds";
import * as Effect from "effect/Effect";
import { makePaginatedUsers, makeUser } from "../fixtures/user";
import { getEndpoint, typedHandler } from "../typed-handler";

const findEndpoint = getEndpoint(UserContract.Group, "find");
const createEndpoint = getEndpoint(UserContract.Group, "create");
const deleteEndpoint = getEndpoint(UserContract.Group, "delete");

export const usersHandlers = {
  /** GET /users — returns a paginated page using whatever the test passed. */
  list: (arg: ReadonlyArray<UserContract.User> | UserContract.PaginatedUsers = []) =>
    typedHandler(findEndpoint, ({ urlParams }) =>
      Effect.succeed(
        arg instanceof UserContract.PaginatedUsers
          ? arg
          : makePaginatedUsers({
              users: arg,
              page: urlParams.page,
              pageSize: urlParams.pageSize,
              total: arg.length,
            }),
      ),
    ),

  /**
   * POST /users — outcome is either success (returns a `CreateUserResponse`
   * with the supplied id, defaulting to a fresh one) or a tagged-error
   * variant from the declared union.
   */
  create: (
    outcome:
      | { readonly result: "success"; readonly id?: UserId }
      | { readonly result: "UserAlreadyExistsError"; readonly message?: string },
  ) =>
    typedHandler(createEndpoint, ({ payload }) => {
      if (outcome.result === "success") {
        const id = outcome.id ?? makeUser().id;
        return Effect.succeed(new UserContract.CreateUserResponse({ id }));
      }
      return Effect.fail(
        new UserContract.UserAlreadyExistsError({
          email: payload.email,
          message: outcome.message ?? "A user with that email already exists.",
        }),
      );
    }),

  /**
   * DELETE /users/:id — `success` returns 204; `UserNotFoundError` returns 404
   * with the contract's error shape.
   */
  delete: (outcome: { readonly result: "success" | "UserNotFoundError" }) =>
    typedHandler(deleteEndpoint, ({ path }) => {
      if (outcome.result === "success") return Effect.void;
      return Effect.fail(
        new UserContract.UserNotFoundError({
          userId: path.id,
          message: "User not found.",
        }),
      );
    }),
};
