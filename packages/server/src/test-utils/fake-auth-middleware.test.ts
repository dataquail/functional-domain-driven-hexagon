import { UserAuthMiddlewareFake } from "@/test-utils/fake-auth-middleware.js";
import * as Layer from "effect/Layer";
import { describe, expect, it } from "vitest";

// The middleware itself can only be evaluated inside an HTTP request scope
// (Provided context). End-to-end coverage of the fake's behavior comes from
// every existing endpoint integration test that runs against
// `TestServerLive` — they pass precisely because this fake provides the
// admin CurrentUser. This file just verifies the Layer remains importable
// and well-formed so a refactor can't silently strip it.
describe("UserAuthMiddlewareFake", () => {
  it("is a valid Layer", () => {
    expect(Layer.isLayer(UserAuthMiddlewareFake)).toBe(true);
  });
});
