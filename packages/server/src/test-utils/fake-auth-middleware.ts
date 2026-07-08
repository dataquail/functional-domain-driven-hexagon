import { type CurrentUser, UserAuthMiddleware } from "@org/contracts/Policy";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { UserId } from "@/platform/ids/user-id.js";

// Test-only middleware. Existing endpoint integration tests don't carry
// a session cookie; the default returns a deterministic super-admin
// CurrentUser so they keep driving the same protected endpoints they
// did before the cookie swap.
//
// Phase 1.5 also exposes a non-super-admin variant for authz tests —
// see `UserAuthMiddlewareFakeAsMember` below. The real (cookie-based)
// middleware lives in `platform/middlewares/auth-middleware-live.ts`
// and is exercised by auth-module integration tests + Playwright.

export const makeUserAuthMiddlewareFake = (currentUser: CurrentUser["Service"]) =>
  Layer.succeed(UserAuthMiddleware, Effect.succeed(currentUser));

// The default fake's userId is paired with a `platform.roles` seed in
// `useServerTestRuntime` so the `RoleService` ACL surfaces this caller
// as super_admin for the authz layer.
export const SUPER_ADMIN_CALLER_ID = UserId.make("00000000-0000-0000-0000-000000000001");
export const MEMBER_CALLER_ID = UserId.make("00000000-0000-0000-0000-000000000002");

export const UserAuthMiddlewareFake = makeUserAuthMiddlewareFake({
  sessionId: "test-session",
  userId: SUPER_ADMIN_CALLER_ID,
});

// Non-super-admin variant: tests that exercise the 403 path on
// super-admin-only endpoints compose this in place of the default
// `UserAuthMiddlewareFake` via the runtime's `server` override. No
// platform.roles seed is needed for this caller.
export const UserAuthMiddlewareFakeAsMember = makeUserAuthMiddlewareFake({
  sessionId: "test-session",
  userId: MEMBER_CALLER_ID,
});
