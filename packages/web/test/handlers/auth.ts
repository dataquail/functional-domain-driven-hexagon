// Auth handler builders. The BFF's `/auth/me` decides whether the FE
// considers the user signed in. In jsdom tests the session cookie
// itself is irrelevant — only the `/auth/me` response matters, so
// `signedInAs(user)` and `signedOut()` are enough.
//
// `/auth/me`'s contract declares no error union (the 401 comes from
// `UserAuthMiddleware`, not the endpoint), so `signedOut()` bypasses
// `typedHandler` and emits a raw 401 response that mirrors what the
// middleware would produce.

import * as AuthContract from "@org/contracts/api/AuthContract";
import * as Effect from "effect/Effect";
import { http, HttpResponse } from "msw";
import { makeCurrentUser } from "../fixtures/auth";
import { getEndpoint, TEST_API_BASE, typedHandler } from "../typed-handler";

const meEndpoint = getEndpoint(AuthContract.PrivateGroup, "me");
const meUrl = `${TEST_API_BASE}${meEndpoint.path}`;

export const authHandlers = {
  /** `/auth/me` returns `CurrentUserResponse`. Defaults to a guest user. */
  signedInAs: (overrides?: Parameters<typeof makeCurrentUser>[0]) =>
    typedHandler(meEndpoint, () => Effect.succeed(makeCurrentUser(overrides))),

  /** `/auth/me` returns 401 — the `(authed)` layout will redirect to /login. */
  signedOut: () =>
    http.get(meUrl, () =>
      HttpResponse.json({ _tag: "Unauthorized", message: "Not authenticated." }, { status: 401 }),
    ),
};
