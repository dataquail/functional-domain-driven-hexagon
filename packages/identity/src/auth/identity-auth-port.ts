import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import type { SeededUser, SeedRequest } from "../seed/identity-seed";
import { seedIdentity } from "../seed/identity-seed";
import type { ClientCredentials, IdentityAuth } from "./identity-auth";

export type SignInInput = {
  readonly request: Request;
  readonly email: string;
  readonly password: string;
  readonly oauthQuery: string;
};

export type SignUpInput = {
  readonly request: Request;
  readonly name: string;
  readonly email: string;
  readonly password: string;
  readonly callbackUrl: string;
};

export type PasswordResetRequestInput = {
  readonly request: Request;
  readonly email: string;
  readonly redirectTo: string;
};

export type PasswordResetInput = {
  readonly request: Request;
  readonly token: string;
  readonly newPassword: string;
};

export type ConsentInput = {
  readonly request: Request;
  readonly accept: boolean;
  readonly oauthQuery: string;
};

export type IdentityAuthPort = {
  readonly handle: (request: Request) => Effect.Effect<Response>;
  readonly signIn: (input: SignInInput) => Effect.Effect<Response>;
  readonly signUp: (input: SignUpInput) => Effect.Effect<Response>;
  readonly requestPasswordReset: (input: PasswordResetRequestInput) => Effect.Effect<Response>;
  readonly resetPassword: (input: PasswordResetInput) => Effect.Effect<Response>;
  readonly consent: (input: ConsentInput) => Effect.Effect<Response>;
  readonly seed: (request: SeedRequest) => Effect.Effect<ReadonlyArray<SeededUser>>;
};

const withOAuthQuery = (oauthQuery: string) => {
  if (oauthQuery === "") return {};

  return { oauth_query: oauthQuery };
};

const once = <A>(make: () => A): (() => A) => {
  let made = Option.none<A>();

  return () =>
    Option.getOrElse(made, () => {
      const value = make();
      made = Option.some(value);

      return value;
    });
};

// Built on first use: a page that renders a form never needs the database.
export const betterAuthPort = (
  makeAuth: () => IdentityAuth,
  makeSeedingAuth: (client: Option.Option<ClientCredentials>) => IdentityAuth,
): IdentityAuthPort => {
  const auth = once(makeAuth);

  return {
    handle: (request) => Effect.promise(() => auth().handler(request)),
    // The authorize continuation reads the request itself, so it must ride along with the headers.
    signIn: ({ email, oauthQuery, password, request }) =>
      Effect.promise(() =>
        auth().api.signInEmail({
          body: { email, password, ...withOAuthQuery(oauthQuery) },
          headers: request.headers,
          request,
          asResponse: true,
        }),
      ),
    signUp: ({ callbackUrl, email, name, password, request }) =>
      Effect.promise(() =>
        auth().api.signUpEmail({
          body: { name, email, password, callbackURL: callbackUrl },
          headers: request.headers,
          asResponse: true,
        }),
      ),
    requestPasswordReset: ({ email, redirectTo, request }) =>
      Effect.promise(() =>
        auth().api.requestPasswordReset({
          body: { email, redirectTo },
          headers: request.headers,
          asResponse: true,
        }),
      ),
    resetPassword: ({ newPassword, request, token }) =>
      Effect.promise(() =>
        auth().api.resetPassword({
          body: { token, newPassword },
          headers: request.headers,
          asResponse: true,
        }),
      ),
    consent: ({ accept, oauthQuery, request }) =>
      Effect.promise(() =>
        auth().api.oauth2Consent({
          body: { accept, ...withOAuthQuery(oauthQuery) },
          headers: request.headers,
          request,
          asResponse: true,
        }),
      ),
    seed: (request) =>
      seedIdentity(makeSeedingAuth(Option.fromUndefinedOr(request.client)), request),
  };
};
