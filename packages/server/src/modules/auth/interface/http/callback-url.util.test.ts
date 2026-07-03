import { describe, expect, it } from "vitest";

import { buildCallbackUrl } from "./callback-url.util.js";

// The deterministic substructure of the callback endpoint worth pinning: the
// reconstruction of the absolute callback URL openid-client receives. Off-by-one
// mistakes here mean Zitadel rejects every token exchange with "redirect_uri
// does not correspond" (ADR-0018, "How the /api/* proxy works"). The full
// callback flow is covered e2e by Playwright + the SessionRepositoryLive test.

describe("buildCallbackUrl", () => {
  const env = "http://localhost:3001/api/auth/callback";

  it("uses the env-configured URI for origin+path (preserves the `/api` prefix that Next strips)", () => {
    const url = buildCallbackUrl(env, "/auth/callback?code=abc&state=xyz");
    expect(url.origin).toBe("http://localhost:3001");
    expect(url.pathname).toBe("/api/auth/callback");
  });

  it("carries the query string from the inbound request unchanged", () => {
    const url = buildCallbackUrl(env, "/auth/callback?code=abc&state=xyz");
    expect(url.searchParams.get("code")).toBe("abc");
    expect(url.searchParams.get("state")).toBe("xyz");
  });

  it("handles a request with no query string", () => {
    const url = buildCallbackUrl(env, "/auth/callback");
    expect(url.search).toBe("");
    expect(url.pathname).toBe("/api/auth/callback");
  });

  it("ignores the inbound URL's path entirely (Next-rewrite trap)", () => {
    // The inbound `requestUrl` is `/auth/callback?...` (Next stripped `/api`),
    // but the helper must not produce `http://localhost:3001/auth/callback`
    // because Zitadel registered `/api/auth/callback`. The env value wins.
    const url = buildCallbackUrl(env, "/totally/different/path?code=abc");
    expect(url.pathname).toBe("/api/auth/callback");
    expect(url.searchParams.get("code")).toBe("abc");
  });

  it("preserves multiple values for the same query key", () => {
    const url = buildCallbackUrl(env, "/auth/callback?scope=openid&scope=profile&code=abc");
    expect(url.searchParams.getAll("scope")).toEqual(["openid", "profile"]);
  });

  it("works against an https origin (production-shaped redirect URI)", () => {
    const url = buildCallbackUrl(
      "https://app.example.com/api/auth/callback",
      "/auth/callback?code=abc",
    );
    expect(url.origin).toBe("https://app.example.com");
    expect(url.pathname).toBe("/api/auth/callback");
    expect(url.searchParams.get("code")).toBe("abc");
  });
});
