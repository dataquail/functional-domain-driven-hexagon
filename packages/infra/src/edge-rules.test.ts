import { describe, expect, it } from "@effect/vitest";

import { authRateLimitRule, killSwitchRule } from "./edge-rules.js";

const hosts = {
  app: ["app.example.com", "app.staging.example.com"],
  identity: ["auth.example.com", "auth.staging.example.com"],
};

describe("authRateLimitRule", () => {
  it("counts sign-in and sign-up on the identity hosts and every app auth endpoint", () => {
    expect(authRateLimitRule(hosts).expression).toBe(
      '(http.host in {"auth.example.com" "auth.staging.example.com"} and starts_with(http.request.uri.path, "/api/auth/sign-"))' +
        ' or (http.host in {"app.example.com" "app.staging.example.com"} and starts_with(http.request.uri.path, "/api/auth/"))',
    );
  });

  it("blocks a client for ten minutes after twenty attempts in a minute", () => {
    expect(authRateLimitRule(hosts).ratelimit).toEqual({
      characteristics: ["cf.colo.id", "ip.src"],
      period: 60,
      requestsPerPeriod: 20,
      mitigationTimeout: 600,
    });
  });
});

describe("killSwitchRule", () => {
  it("blocks every app and identity host, and only while engaged", () => {
    expect(killSwitchRule(hosts, false)).toEqual({
      description: "Kill switch: refuse every request to the app and identity hosts",
      expression:
        'http.host in {"app.example.com" "app.staging.example.com" "auth.example.com" "auth.staging.example.com"}',
      action: "block",
      enabled: false,
    });
    expect(killSwitchRule(hosts, true).enabled).toBe(true);
  });
});
