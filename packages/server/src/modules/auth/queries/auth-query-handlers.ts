import { findSessionQuerySpanAttributes } from "@/modules/auth/queries/find-session-query.js";
import { findSession } from "@/modules/auth/queries/find-session.js";
import { queryHandlers } from "@/platform/query-bus.js";

export const authQueryHandlers = queryHandlers({
  FindSessionQuery: { handle: findSession, spanAttributes: findSessionQuerySpanAttributes },
});
