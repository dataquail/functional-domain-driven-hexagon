import { type FindUsersResult, FindUsersQuery } from "@/modules/user/queries/find-users-query.js";
import { type EndpointRequest } from "@/platform/http-endpoint.js";
import { QueryBus } from "@/platform/query-bus.js";
import { UserContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";

const toPaginatedUsersContract = (result: FindUsersResult): UserContract.PaginatedUsers =>
  new UserContract.PaginatedUsers({
    users: result.users.map(
      (user) =>
        new UserContract.User({
          id: user.id,
          email: user.email,
          role: user.role,
          address: user.address,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        }),
    ),
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
  });

export const findEndpoint = (request: EndpointRequest<typeof UserContract.Group, "find">) =>
  Effect.gen(function* () {
    const queryBus = yield* QueryBus;
    const result = yield* queryBus.execute(
      FindUsersQuery.make({
        page: request.urlParams.page,
        pageSize: request.urlParams.pageSize,
      }),
    );
    return toPaginatedUsersContract(result);
  }).pipe(Effect.withSpan("UserHttpLive.find"));
