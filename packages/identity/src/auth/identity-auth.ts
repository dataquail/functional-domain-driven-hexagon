import { oauthProvider } from "@better-auth/oauth-provider";
import { type Auth, betterAuth, type BetterAuthOptions } from "better-auth";
import { jwt } from "better-auth/plugins";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
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
  readonly runInBackground: Option.Option<(task: Promise<unknown>) => void>;
  readonly sendVerificationOnSignUp?: boolean;
  readonly registerClientAs: Option.Option<ClientCredentials>;
};

const clientCredentialGenerators = (credentials: Option.Option<ClientCredentials>) =>
  Option.match(credentials, {
    onNone: () => ({}),
    onSome: ({ clientId, clientSecret }) => ({
      generateClientId: () => clientId,
      generateClientSecret: () => clientSecret,
    }),
  });

// Better Auth skips its origin check under a test runner unless told otherwise.
const advancedOptions = (
  runInBackground: IdentityAuthSettings["runInBackground"],
): BetterAuthOptions["advanced"] =>
  Option.match(runInBackground, {
    onNone: () => ({ disableOriginCheck: false }),
    onSome: (handler) => ({ disableOriginCheck: false, backgroundTasks: { handler } }),
  });

type IdentityPlugins = [ReturnType<typeof jwt>, ReturnType<typeof oauthProvider>];

// Named rather than inferred: Better Auth's inferred instance type is too large to emit.
type IdentityAuthOptions = BetterAuthOptions & { plugins: IdentityPlugins };

export type IdentityAuth = Auth<IdentityAuthOptions>;

const identityAuthOptions = (settings: IdentityAuthSettings): IdentityAuthOptions => ({
  baseURL: settings.baseUrl,
  secret: settings.secret,
  database: settings.database,
  trustedOrigins: [settings.baseUrl, settings.appUrl],
  advanced: advancedOptions(settings.runInBackground),
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
});

export const identityAuthFor = (settings: IdentityAuthSettings): IdentityAuth =>
  betterAuth(identityAuthOptions(settings));
