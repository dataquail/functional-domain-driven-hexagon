import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { afterAll, beforeEach } from "vitest";

import {
  APP_URL,
  formPost,
  IDENTITY_BASE_URL,
  linkIn,
  makeIdentityTestHarness,
} from "../test-utils/identity-test-auth.js";
import { betterAuthPort } from "./identity-auth-port.js";

const harness = makeIdentityTestHarness();
const port = () => betterAuthPort(harness.makeAuth, harness.makeSeedingAuth);

const appClient = {
  clientId: "effect-monorepo-app",
  clientSecret: "integration-client-secret",
  clientName: "Effect Monorepo",
  redirectUris: [`${APP_URL}/api/auth/callback`],
  postLogoutRedirectUris: [`${APP_URL}/`],
};
const admin = { email: "admin@example.com", password: "Password123!", name: "Admin" };

const json = (response: Response) => Effect.promise(() => response.json());

// Better Auth redirects a navigation and answers anything else with `{ url }`.
const redirectTarget = (response: Response) =>
  Effect.gen(function* () {
    const location = response.headers.get("location");
    if (location !== null) return location;
    return ((yield* json(response)) as { url: string }).url;
  });

describe("betterAuthPort (integration)", () => {
  beforeEach(() => harness.reset());
  afterAll(() => harness.close());

  it.effect(
    "signs a seeded user in and continues the authorize request to the app's callback",
    () =>
      Effect.gen(function* () {
        const auth = port();
        yield* auth.seed({ client: appClient, users: [admin] });

        const authorize = yield* auth.handle(
          new Request(
            `${IDENTITY_BASE_URL}/api/auth/oauth2/authorize?${new URLSearchParams({
              response_type: "code",
              client_id: appClient.clientId,
              redirect_uri: appClient.redirectUris[0] ?? "",
              scope: "openid email profile offline_access",
              state: "s1",
              code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
              code_challenge_method: "S256",
              prompt: "login",
            }).toString()}`,
          ),
        );
        const loginPage = new URL(yield* redirectTarget(authorize), IDENTITY_BASE_URL);
        expect(loginPage.pathname).toBe("/sign-in");

        const oauthQuery = loginPage.search.slice(1);
        const signedIn = yield* auth.signIn({
          request: formPost(`/sign-in?${oauthQuery}`, admin),
          email: admin.email,
          password: admin.password,
          oauthQuery,
        });

        const callback = new URL(yield* redirectTarget(signedIn));
        expect(`${callback.origin}${callback.pathname}`).toBe(`${APP_URL}/api/auth/callback`);
        expect(callback.searchParams.get("state")).toBe("s1");
        expect(callback.searchParams.get("code")).not.toBeNull();
      }),
  );

  it.effect("signs a new user up unverified and mails them a verification link", () =>
    Effect.gen(function* () {
      const auth = port();
      const member = { name: "Ada", email: "ada@example.com", password: "Password123!" };

      const signedUp = yield* auth.signUp({
        request: formPost("/sign-up", member),
        ...member,
        callbackUrl: APP_URL,
      });
      expect(signedUp.ok).toBe(true);
      expect(harness.sent.map((email) => [email.to, email.subject])).toEqual([
        ["ada@example.com", "Verify your email address"],
      ]);

      const beforeVerifying = yield* auth.signIn({
        request: formPost("/sign-in", member),
        email: member.email,
        password: member.password,
        oauthQuery: "",
      });
      expect(beforeVerifying.status).toBe(403);
      expect(yield* json(beforeVerifying)).toMatchObject({ code: "EMAIL_NOT_VERIFIED" });

      const verified = yield* auth.handle(new Request(linkIn(harness.sent[0])));
      expect(verified.status).toBe(302);

      const afterVerifying = yield* auth.signIn({
        request: formPost("/sign-in", member),
        email: member.email,
        password: member.password,
        oauthQuery: "",
      });
      expect(afterVerifying.ok).toBe(true);
    }),
  );

  it.effect("resets a forgotten password through the link it mails", () =>
    Effect.gen(function* () {
      const auth = port();
      yield* auth.seed({ users: [admin] });

      yield* auth.requestPasswordReset({
        request: formPost("/forgot-password", { email: admin.email }),
        email: admin.email,
        redirectTo: `${IDENTITY_BASE_URL}/reset-password`,
      });
      const followed = yield* auth.handle(new Request(linkIn(harness.sent[0])));
      const token = new URL(followed.headers.get("location") ?? "").searchParams.get("token");
      expect(token).not.toBeNull();

      const reset = yield* auth.resetPassword({
        request: formPost("/reset-password", {}),
        token: token ?? "",
        newPassword: "AnotherPassword456!",
      });
      expect(reset.ok).toBe(true);

      const signedIn = yield* auth.signIn({
        request: formPost("/sign-in", {}),
        email: admin.email,
        password: "AnotherPassword456!",
        oauthQuery: "",
      });
      expect(signedIn.ok).toBe(true);
    }),
  );

  it.effect("refuses a consent decision from someone who is not signed in", () =>
    Effect.gen(function* () {
      const refused = yield* port().consent({
        request: formPost("/consent", { accept: "true" }),
        accept: true,
        oauthQuery: "",
      });
      expect(refused.status).toBe(401);
    }),
  );
});
