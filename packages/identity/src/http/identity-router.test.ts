import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import type { IdentityAuthPort, SignInInput } from "../auth/identity-auth-port.js";
import type { SeedRequest, SeedUser } from "../seed/identity-seed.js";
import { handleIdentityRequest, type IdentityRouterContext } from "./identity-router.js";

const BASE = "http://localhost:3002";
const APP_URL = "http://localhost:3000";

const unexpected = (): Effect.Effect<Response> => Effect.die("not expected in this test");

const text = (response: Response) => Effect.promise(() => response.text());

const authPort = (overrides: Partial<IdentityAuthPort> = {}): IdentityAuthPort => ({
  handle: unexpected,
  signIn: unexpected,
  signUp: unexpected,
  requestPasswordReset: unexpected,
  resetPassword: unexpected,
  consent: unexpected,
  seed: () => Effect.die("not expected in this test"),
  ...overrides,
});

const context = (
  auth: IdentityAuthPort,
  seedToken: string | undefined = undefined,
): IdentityRouterContext => ({ auth, appUrl: APP_URL, seedToken });

const form = (path: string, fields: Record<string, string>) =>
  new Request(`${BASE}${path}`, { method: "POST", body: new URLSearchParams(fields) });

describe("handleIdentityRequest", () => {
  it.effect("hands everything under /api/auth to Better Auth untouched", () =>
    Effect.gen(function* () {
      const seen: Array<string> = [];
      const auth = authPort({
        handle: (request) => {
          seen.push(request.url);
          return Effect.succeed(Response.json({ issuer: `${BASE}/api/auth` }));
        },
      });

      const response = yield* handleIdentityRequest(
        new Request(`${BASE}/api/auth/.well-known/openid-configuration`),
        context(auth),
      );

      expect(response.status).toBe(200);
      expect(seen).toEqual([`${BASE}/api/auth/.well-known/openid-configuration`]);
    }),
  );

  it.effect("renders the sign-in form posting back to itself with the signed authorize query", () =>
    Effect.gen(function* () {
      const response = yield* handleIdentityRequest(
        new Request(`${BASE}/sign-in?client_id=app&sig=abc`),
        context(authPort()),
      );

      expect(response.status).toBe(200);
      expect(yield* text(response)).toContain(`action="/sign-in?client_id=app&amp;sig=abc"`);
    }),
  );

  it.effect(
    "continues the authorize flow when Better Auth answers a sign-in with a redirect URL",
    () =>
      Effect.gen(function* () {
        const calls: Array<Omit<SignInInput, "request">> = [];
        const auth = authPort({
          signIn: ({ request: _request, ...input }) => {
            calls.push(input);
            return Effect.succeed(
              Response.json(
                { redirect: true, url: `${APP_URL}/api/auth/callback?code=c` },
                { headers: { "set-cookie": "better-auth.session_token=t; Path=/" } },
              ),
            );
          },
        });

        const response = yield* handleIdentityRequest(
          form("/sign-in?client_id=app&sig=abc", { email: "ada@example.com", password: "pw" }),
          context(auth),
        );

        expect(calls).toEqual([
          { email: "ada@example.com", password: "pw", oauthQuery: "client_id=app&sig=abc" },
        ]);
        expect(response.status).toBe(302);
        expect(response.headers.get("location")).toBe(`${APP_URL}/api/auth/callback?code=c`);
        expect(response.headers.getSetCookie()).toEqual(["better-auth.session_token=t; Path=/"]);
      }),
  );

  it.effect("passes a redirect Better Auth already issued straight through", () =>
    Effect.gen(function* () {
      const auth = authPort({
        signIn: () =>
          Effect.succeed(new Response(null, { status: 302, headers: { location: "/elsewhere" } })),
      });

      const response = yield* handleIdentityRequest(
        form("/sign-in", { email: "a@b.c", password: "pw" }),
        context(auth),
      );

      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe("/elsewhere");
    }),
  );

  it.effect("sends a direct sign-in, with no authorize request behind it, on to the app", () =>
    Effect.gen(function* () {
      const auth = authPort({ signIn: () => Effect.succeed(Response.json({ token: "t" })) });

      const response = yield* handleIdentityRequest(
        form("/sign-in", { email: "a@b.c", password: "pw" }),
        context(auth),
      );

      expect(response.headers.get("location")).toBe(APP_URL);
    }),
  );

  it.effect(
    "tells an unverified user to check their inbox rather than that the password is wrong",
    () =>
      Effect.gen(function* () {
        const auth = authPort({
          signIn: () =>
            Effect.succeed(
              Response.json(
                { message: "Email not verified", code: "EMAIL_NOT_VERIFIED" },
                { status: 403 },
              ),
            ),
        });

        const response = yield* handleIdentityRequest(
          form("/sign-in", { email: "a@b.c", password: "pw" }),
          context(auth),
        );

        expect(response.status).toBe(403);
        expect(yield* text(response)).toContain("Verify your email address first");
      }),
  );

  it.effect("re-renders the form with the email kept and a generic error for bad credentials", () =>
    Effect.gen(function* () {
      const auth = authPort({
        signIn: () =>
          Effect.succeed(Response.json({ message: "Invalid email or password" }, { status: 401 })),
      });

      const response = yield* handleIdentityRequest(
        form("/sign-in", { email: "ada@example.com", password: "nope" }),
        context(auth),
      );

      const page = yield* text(response);
      expect(response.status).toBe(401);
      expect(page).toContain("Invalid email or password.");
      expect(page).toContain(`value="ada@example.com"`);
    }),
  );

  it.effect(
    "asks a new user to verify their email, sending the verified user back to the app",
    () =>
      Effect.gen(function* () {
        const callbacks: Array<string> = [];
        const auth = authPort({
          signUp: ({ callbackUrl }) => {
            callbacks.push(callbackUrl);
            return Effect.succeed(Response.json({ token: null }));
          },
        });

        const response = yield* handleIdentityRequest(
          form("/sign-up", { name: "Ada", email: "ada@example.com", password: "password1" }),
          context(auth),
        );

        expect(callbacks).toEqual([APP_URL]);
        expect(yield* text(response)).toContain(
          "We sent a verification link to <strong>ada@example.com</strong>",
        );
      }),
  );

  it.effect("shows Better Auth's reason when it refuses a sign-up", () =>
    Effect.gen(function* () {
      const auth = authPort({
        signUp: () =>
          Effect.succeed(Response.json({ message: "User already exists" }, { status: 422 })),
      });

      const response = yield* handleIdentityRequest(
        form("/sign-up", { name: "Ada", email: "ada@example.com", password: "password1" }),
        context(auth),
      );

      expect(response.status).toBe(422);
      expect(yield* text(response)).toContain("User already exists");
    }),
  );

  it.effect("answers a reset request the same way whether or not the account exists", () =>
    Effect.gen(function* () {
      const redirects: Array<string> = [];
      const auth = authPort({
        requestPasswordReset: ({ redirectTo }) => {
          redirects.push(redirectTo);
          return Effect.succeed(Response.json({ status: true }));
        },
      });

      const response = yield* handleIdentityRequest(
        form("/forgot-password", { email: "nobody@example.com" }),
        context(auth),
      );

      expect(redirects).toEqual([`${BASE}/reset-password`]);
      expect(yield* text(response)).toContain("If an account exists for that address");
    }),
  );

  it.effect(
    "confirms a password change, and keeps the token when Better Auth rejects the new password",
    () =>
      Effect.gen(function* () {
        const outcomes = [
          Response.json({ status: true }),
          Response.json({ message: "Password too short" }, { status: 400 }),
        ];
        const auth = authPort({
          resetPassword: () => Effect.succeed(outcomes.shift() ?? Response.error()),
        });

        const changed = yield* handleIdentityRequest(
          form("/reset-password", { token: "tok", password: "longenough" }),
          context(auth),
        );
        const rejected = yield* handleIdentityRequest(
          form("/reset-password", { token: "tok", password: "x" }),
          context(auth),
        );

        expect(yield* text(changed)).toContain("Your password has been updated.");
        const page = yield* text(rejected);
        expect(page).toContain("Password too short");
        expect(page).toContain(`name="token" value="tok"`);
      }),
  );

  it.effect("renders the consent fallback for the client and scopes being asked for", () =>
    Effect.gen(function* () {
      const response = yield* handleIdentityRequest(
        new Request(`${BASE}/consent?client_id=app&scope=openid+email`),
        context(authPort()),
      );

      const page = yield* text(response);
      expect(page).toContain("<strong>app</strong>");
      expect(page).toContain("<li>openid</li>");
      expect(page).toContain("<li>email</li>");
    }),
  );

  it.effect("returns to the client once the user decides on consent", () =>
    Effect.gen(function* () {
      const decisions: Array<boolean> = [];
      const auth = authPort({
        consent: ({ accept }) => {
          decisions.push(accept);
          return Effect.succeed(
            Response.json({ redirect_uri: `${APP_URL}/api/auth/callback?code=c` }),
          );
        },
      });

      const response = yield* handleIdentityRequest(
        form("/consent?client_id=app", { accept: "true" }),
        context(auth),
      );

      expect(decisions).toEqual([true]);
      expect(response.headers.get("location")).toBe(`${APP_URL}/api/auth/callback?code=c`);
    }),
  );

  it.effect("sends a visitor at the root on to the app, and anything unknown to a 404", () =>
    Effect.gen(function* () {
      const root = yield* handleIdentityRequest(new Request(`${BASE}/`), context(authPort()));
      const unknown = yield* handleIdentityRequest(
        new Request(`${BASE}/admin`),
        context(authPort()),
      );

      expect(root.headers.get("location")).toBe(APP_URL);
      expect(unknown.status).toBe(404);
    }),
  );

  describe("seeding", () => {
    const seedRequest: SeedRequest = {
      users: [{ email: "admin@example.com", password: "pw", name: "Admin" }],
    };
    const seedCall = (token: string | null, body: unknown = seedRequest) =>
      new Request(`${BASE}/internal/seed`, {
        method: "POST",
        headers: token === null ? {} : { authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

    it.effect("does not exist on a stage that configured no seed token", () =>
      Effect.gen(function* () {
        const response = yield* handleIdentityRequest(seedCall("anything"), context(authPort()));
        expect(response.status).toBe(404);
      }),
    );

    it.effect("refuses a caller without the seed token", () =>
      Effect.gen(function* () {
        const response = yield* handleIdentityRequest(
          seedCall("wrong"),
          context(authPort(), "seed-token"),
        );
        expect(response.status).toBe(401);
      }),
    );

    it.effect("refuses a body that is not a seed request", () =>
      Effect.gen(function* () {
        const response = yield* handleIdentityRequest(
          seedCall("seed-token", { users: [] }),
          context(authPort(), "seed-token"),
        );
        expect(response.status).toBe(400);
      }),
    );

    it.effect("seeds the users and answers with the subject each one signs in as", () =>
      Effect.gen(function* () {
        const auth = authPort({
          seed: ({ users }) =>
            Effect.succeed(
              users.map((user: SeedUser) => ({ email: user.email, subject: `sub-${user.email}` })),
            ),
        });

        const response = yield* handleIdentityRequest(
          seedCall("seed-token"),
          context(auth, "seed-token"),
        );

        expect(yield* Effect.promise(() => response.json())).toEqual({
          users: [{ email: "admin@example.com", subject: "sub-admin@example.com" }],
        });
      }),
    );
  });
});
