import { findUsersQuerySpanAttributes } from "@/modules/user/queries/find-users-query.js";
import { findUsers } from "@/modules/user/queries/find-users.js";
import { queryHandlers } from "@/platform/query-bus.js";

export const userQueryHandlers = queryHandlers({
  FindUsersQuery: { handle: findUsers, spanAttributes: findUsersQuerySpanAttributes },
});
