import { describe, expect, it } from "vitest";

import { callbackEndpoint } from "./callback.endpoint.js";

// The callback endpoint's full flow — verifying the PKCE cookie, exchanging
// the code with Zitadel, signing the session — needs a live Zitadel and is
// covered end-to-end by Playwright (`packages/acceptance/specs/login.spec.ts`)
// and at the persistence boundary by the SessionRepositoryLive integration
// test. Its deterministic substructure — the absolute-callback-URL
// reconstruction — is unit-tested in `callback-url.util.test.ts`.

describe("callbackEndpoint", () => {
  it("exports a callable endpoint factory", () => {
    expect(typeof callbackEndpoint).toBe("function");
  });
});
