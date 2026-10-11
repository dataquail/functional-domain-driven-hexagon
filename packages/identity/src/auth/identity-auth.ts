import { oauthProvider } from "@better-auth/oauth-provider";
import { type Auth, betterAuth, type BetterAuthOptions } from "better-auth";
import { jwt } from "better-auth/plugins";
import * as Effect from "effect/Effect";
import type { Pool } from "pg";

import { passwordResetEmail, verificationEmail } from "../mail/identity-emails.js";
import type { IdentityMailer } from "../mail/identity-mailer.js";
import { idTokenEmailClaims } from "./id-token-claims.js";

export const IDENTITY_SCOPES = ["openid", "profile", "email", "offline_access"];

export const LOGIN_PAGE = "/sign-in";
export const CONSENT_PAGE = "/consent";

export type ClientCredentials = {
  readonly clientId: string;
  readonly clientSecret: string;
};

export type IdentityAuthSettings = {
  readonly baseUrl: string;
  readonly secret: string;
  readonly appUrl: string;
  readonly database: Pool;
  readonly mailer: IdentityMailer;
  readonly runInBackground?: (task: Promise<unknown>) => void;
  readonly sendVerificationOnSignUp?: boolean;
  readonly registerClientAs?: ClientCredentials;
};

const clientCredentialGenerators = (credentials: ClientCredentials | undefined) =>
  credentials === undefined
    ? {}
    : {
        generateClientId: () => credentials.clientId,
        generateClientSecret: () => credentials.clientSecret,
      };

type IdentityPlugins = [ReturnType<typeof jwt>, ReturnType<typeof oauthProvider>];

// Named rather than inferred: Better Auth's inferred instance type is too large to emit.
type IdentityAuthOptions = BetterAuthOptions & { plugins: IdentityPlugins };

export type IdentityAuth = Auth<IdentityAuthOptions>;

const identityAuthOptions = (settings: IdentityAuthSettings): IdentityAuthOptions => ({
  baseURL: settings.baseUrl,
  secret: settings.secret,
  database: settings.database,
  trustedOrigins: [settings.baseUrl],
  disabledPaths: ["/token"],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: ({ url, user }) =>
      Effect.runPromise(settings.mailer.send(passwordResetEmail({ to: user.email, url }))),
  },
  emailVerification: {
    sendOnSignUp: settings.sendVerificationOnSignUp ?? true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: ({ url, user }) =>
      Effect.runPromise(settings.mailer.send(verificationEmail({ to: user.email, url }))),
  },
  plugins: [
    jwt(),
    oauthProvider({
      loginPage: LOGIN_PAGE,
      consentPage: CONSENT_PAGE,
      scopes: IDENTITY_SCOPES,
      allowDynamicClientRegistration: false,
      customIdTokenClaims: idTokenEmailClaims,
      ...clientCredentialGenerators(settings.registerClientAs),
    }),
  ],
  ...(settings.runInBackground === undefined
    ? {}
    : { advanced: { backgroundTasks: { handler: settings.runInBackground } } }),
});

export const makeIdentityAuth = (settings: IdentityAuthSettings): IdentityAuth =>
  betterAuth(identityAuthOptions(settings));
