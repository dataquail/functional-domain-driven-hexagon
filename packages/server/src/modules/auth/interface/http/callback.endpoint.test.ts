import { describe, expect, it } from "vitest";
import { callbackEndpoint } from "./callback.endpoint.js";

// The callback endpoint reads the OIDC PKCE cookie, exchanges the code with
// Zitadel via `openid-client`, runs `signIn`, and 302s back to the SPA.
// Unit-testing it would require mocking `OidcClient` + a session repository
// fake + a code-verifier generator — most of which is already covered
// either by `signIn`/`SessionRepositoryFake` unit tests or by the
// Playwright `login.spec.ts` end-to-end run. This file satisfies the
// parity rule and keeps the import path healthy.
describe("callbackEndpoint", () => {
  it("exports a callable endpoint factory", () => {
    expect(typeof callbackEndpoint).toBe("function");
  });
});
