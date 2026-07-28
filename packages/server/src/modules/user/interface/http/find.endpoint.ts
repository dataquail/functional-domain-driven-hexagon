import { UserContract } from "@org/contracts/api/Contracts";
import { QueryBus } from "@org/cqrs";
import * as Effect from "effect/Effect";

import { FindUsersQuery, type FindUsersResult } from "@/modules/user/queries/find-users.query.js";
import { type EndpointRequest, recoverPersistenceUnavailable } from "@/platform/http-endpoint.js";

const toPaginatedUsersContract = (result: FindUsersResult): UserContract.PaginatedUsers =>
  new UserContract.PaginatedUsers({
    users: result.users.map(
      (user) =>
        new UserContract.User({
          id: user.id,
          email: user.email,
          address: user.address,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        }),
    ),
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
  });

export const findEndpoint = Effect.fn("UserLive.find")(function* (
  request: EndpointRequest<typeof UserContract.Group, "find">,
) {
  const queryBus = yield* QueryBus;
  const result = yield* queryBus.execute(FindUsersQuery, {
    page: request.query.page,
    pageSize: request.query.pageSize,
  });
  return toPaginatedUsersContract(result);
}, recoverPersistenceUnavailable);
