// MSW node server shared across the integration-tier suite. Tests
// import `server` and `defaultHandlers`; lifecycle is set up via
// `installMswLifecycle()` (call once per file, top-level), which wires
// `beforeAll` / `afterEach` / `afterAll` hooks. The default handler
// set 401s `/auth/me`; per-test overrides go through `server.use(...)`.

import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { defaultHandlers } from "./handlers";

export const server = setupServer();

/**
 * Install MSW lifecycle hooks. Call at the top of each integration
 * test file. Centralising the lifecycle here keeps the
 * `onUnhandledRequest: "error"` policy non-bypassable and keeps each
 * test file from re-declaring four hook calls.
 */
export const installMswLifecycle = (): void => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
  });
  beforeEach(() => {
    server.use(...defaultHandlers);
  });
  afterEach(() => {
    server.resetHandlers();
  });
  afterAll(() => {
    server.close();
  });
};
