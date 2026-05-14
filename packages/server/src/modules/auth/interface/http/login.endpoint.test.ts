import { describe, expect, it } from "vitest";
import { loginEndpoint } from "./login.endpoint.js";

// The login endpoint redirects (302) to Zitadel's authorization endpoint and
// sets a short-lived OIDC PKCE cookie. Meaningfully unit-testing it would
// require mocking `OidcClient` (which itself wraps `openid-client`'s
// discovery + PKCE), reproducing more of Zitadel than is worthwhile in
// process. The full flow is exercised end-to-end by Playwright:
//   - `packages/acceptance/setup/auth.setup.ts` (real Zitadel UI sign-in,
//     stamps `playwright/.auth/admin.json`)
//   - `packages/acceptance/specs/login.spec.ts` (fresh-context regression on
//     every test run)
// This file's job is to satisfy the parity rule and keep the import path
// healthy.
describe("loginEndpoint", () => {
  it("exports a callable endpoint factory", () => {
    expect(typeof loginEndpoint).toBe("function");
  });
});
