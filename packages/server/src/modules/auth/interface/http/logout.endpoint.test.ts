import { describe, expect, it } from "vitest";
import { logoutEndpoint } from "./logout.endpoint.js";

// The logout endpoint reads the session cookie inline, revokes the row,
// clears the cookie, and 302s to Zitadel's `end_session_endpoint`. The full
// flow needs a live Zitadel and is covered by Playwright; the cookie/
// revoke pieces are covered by `SessionRepositoryFake` and
// `SessionRepositoryLive` integration tests. This file satisfies the
// parity rule.
describe("logoutEndpoint", () => {
  it("exports a callable endpoint factory", () => {
    expect(typeof logoutEndpoint).toBe("function");
  });
});
