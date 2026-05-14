// Convenience namespace + the strict baseline handler set used by
// `beforeEach` in `msw-server.ts`. Tests opt into more specific
// responses with `server.use(...)`.

import { authHandlers } from "./auth";
import { usersHandlers } from "./users";

export const handlers = {
  auth: authHandlers,
  users: usersHandlers,
};

/**
 * Default handler list applied before each test. Intentionally
 * conservative — only `/auth/me` has a default. Every other endpoint
 * 404s unless the test opts in via `server.use(...)`. Treat any
 * unhandled request as a test failure (`onUnhandledRequest: "error"`).
 */
export const defaultHandlers = [authHandlers.signedOut()];
