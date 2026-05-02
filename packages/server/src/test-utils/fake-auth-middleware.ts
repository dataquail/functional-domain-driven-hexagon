import { UserId } from "@/platform/ids/user-id.js";
import { type Permission, UserAuthMiddleware } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

// Test-only middleware. Existing endpoint integration tests don't carry a
// session cookie; this returns a deterministic admin CurrentUser so they keep
// driving the same protected endpoints they did before the cookie swap.
// The real (cookie-based) middleware lives in
// `platform/middlewares/auth-middleware-live.ts` and is exercised by
// auth-module integration tests + Playwright.
export const UserAuthMiddlewareFake = Layer.succeed(
  UserAuthMiddleware,
  Effect.succeed({
    sessionId: "test-session",
    userId: UserId.make("00000000-0000-0000-0000-000000000001"),
    permissions: new Set<Permission>(["__test:read", "__test:manage", "__test:delete"]),
  }),
);
