import { describe, expect, it } from "@effect/vitest";

import { applicationTypeFor } from "./identity-seed.js";

describe("applicationTypeFor", () => {
  it("registers a client whose redirects are all plain-http loopback as native", () => {
    expect(
      applicationTypeFor(["http://localhost:3000/api/auth/callback", "http://127.0.0.1:3000/cb"]),
    ).toBe("native");
  });

  it("registers a client with an https redirect as web", () => {
    expect(applicationTypeFor(["https://app.example.com/api/auth/callback"])).toBe("web");
  });

  it("registers a client mixing loopback and public redirects as web, which Better Auth then refuses", () => {
    expect(applicationTypeFor(["http://localhost:3000/cb", "http://app.example.com/cb"])).toBe(
      "web",
    );
  });
});
