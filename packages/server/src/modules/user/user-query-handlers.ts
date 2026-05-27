import { findUsers } from "@/modules/user/queries/find-users.js";
import { findUsersQuerySpanAttributes } from "@/modules/user/queries/find-users-query.js";
import { queryHandlers } from "@/platform/ddd/ports/query-bus.js";

// `FindUsersQuery` reads SQL directly (no UserRepository in R) so the
// handler doesn't need wrapping. Lives at module root for symmetry with
// `user-command-handlers.ts`.
export const userQueryHandlers = queryHandlers({
  FindUsersQuery: { handle: findUsers, spanAttributes: findUsersQuerySpanAttributes },
});
