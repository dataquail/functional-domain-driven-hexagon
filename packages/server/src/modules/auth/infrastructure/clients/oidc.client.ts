import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as openid from "openid-client";

import { EnvVars } from "@/globals/infrastructure/config/env-vars.ts";
import { IssuerTransport } from "@/globals/infrastructure/runtime/issuer-transport.ts";

// The only file in the repo that imports `openid-client`. Used by login, callback and
// logout alone: once a session row exists, the issuer is not consulted again.

export type AuthorizeRequest = {
  readonly url: URL;
  readonly state: string;
  readonly codeVerifier: string;
};

export type CodeExchangeResult = {
  readonly subject: string;
  readonly email: Option.Option<string>;
  readonly emailVerified: boolean;
  readonly idToken: Option.Option<string>;
};

const IdTokenClaims = Schema.Struct({
  sub: Schema.String,
  email: Schema.optionalKey(Schema.Unknown),
  email_verified: Schema.optionalKey(Schema.Unknown),
});

const decodeClaims = Schema.decodeUnknownOption(IdTokenClaims);

const toExchangeResult = (
  claims: typeof IdTokenClaims.Type,
  idToken: Option.Option<string>,
): CodeExchangeResult => ({
  subject: claims.sub,
  email: Option.liftPredicate(claims.email, Predicate.isString),
  emailVerified: claims.email_verified === true,
  idToken,
});

// openid-client carries the issuer's `error` / `error_description` on the
// thrown value; without them every failure reads as one generic error.
const IssuerErrorDetail = Schema.Struct({
  error: Schema.optionalKey(Schema.String),
  error_description: Schema.optionalKey(Schema.String),
  code: Schema.optionalKey(Schema.String),
});

const decodeIssuerErrorDetail = Schema.decodeUnknownOption(IssuerErrorDetail);

const describeExchangeFailure = (cause: unknown): string => {
  const detail = Option.match(decodeIssuerErrorDetail(cause), {
    onNone: () => "",
    onSome: (fields) =>
      [fields.error, fields.error_description, fields.code]
        .filter((value) => Predicate.isString(value) && value !== "")
        .join(" — "),
  });

  if (detail === "") return `OIDC code exchange failed: ${String(cause)}`;

  return `OIDC code exchange failed: ${String(cause)} [${detail}]`;
};

// openid-client hands fetch a plain RequestInit whose body union TypeScript's lib
// does not accept as BodyInit.
const toCustomFetch =
  (fetch: (url: string, init: RequestInit) => Promise<Response>): openid.CustomFetch =>
  (url, options) =>
    // oxlint-disable-next-line effect/noAs, anti-slop/require-safety-comment-for-type-assertion -- openid-client's CustomFetchOptions body is a narrower BodyInit the lib types cannot unify
    fetch(url, options as RequestInit);

const discoveryOptions = (
  customFetch: Option.Option<openid.CustomFetch>,
  allowHttp: boolean,
): openid.DiscoveryRequestOptions => {
  const options: openid.DiscoveryRequestOptions = {};

  if (Option.isSome(customFetch)) options[openid.customFetch] = customFetch.value;

  if (allowHttp) options.execute = [openid.allowInsecureRequests];

  return options;
};

const make = Effect.fn("OidcClient.make")(function* () {
  const env = yield* EnvVars;

  const customFetch = Option.map(
    Option.fromUndefinedOr((yield* Effect.service(IssuerTransport)).fetch),
    toCustomFetch,
  );

  const issuerUrl = new URL(env.IDENTITY_ISSUER);
  const allowHttp = issuerUrl.protocol === "http:";

  // Discovered on first use, so the server boots while the issuer is unreachable.
  const cached = yield* Ref.make(Option.none<openid.Configuration>());

  const discover = Effect.tryPromise(() =>
    openid.discovery(
      issuerUrl,
      env.IDENTITY_CLIENT_ID,
      Redacted.value(env.IDENTITY_CLIENT_SECRET),
      openid.ClientSecretPost(Redacted.value(env.IDENTITY_CLIENT_SECRET)),
      discoveryOptions(customFetch, allowHttp),
    ),
  ).pipe(
    Effect.tap((config) =>
      Effect.sync(() => {
        if (Option.isSome(customFetch)) config[openid.customFetch] = customFetch.value;
      }),
    ),
    Effect.tap((config) => Ref.set(cached, Option.some(config))),
  );

  const getConfig = Effect.flatMap(
    Ref.get(cached),
    Option.match({ onNone: () => discover, onSome: Effect.succeed }),
  );

  const buildAuthorize: Effect.Effect<AuthorizeRequest, CustomHttpApiError.InternalServerError> =
    Effect.gen(function* () {
      const config = yield* getConfig;
      const codeVerifier = openid.randomPKCECodeVerifier();

      const codeChallenge = yield* Effect.tryPromise(() =>
        openid.calculatePKCECodeChallenge(codeVerifier),
      );

      const state = openid.randomState();

      const url = openid.buildAuthorizationUrl(config, {
        redirect_uri: env.IDENTITY_REDIRECT_URI,
        scope: "openid email profile offline_access",
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        state,
        // Always ask for credentials, even over a live identity session.
        prompt: "login",
      });

      return { url, state, codeVerifier };
    }).pipe(
      Effect.mapError(
        (error) =>
          new CustomHttpApiError.InternalServerError({
            message: `Failed to build authorize URL: ${String(error.cause)}`,
          }),
      ),
    );

  const exchangeCode = (
    callbackUrl: URL,
    expectedState: string,
    codeVerifier: string,
  ): Effect.Effect<CodeExchangeResult, CustomHttpApiError.Unauthorized> =>
    Effect.gen(function* () {
      const config = yield* getConfig;

      const tokens = yield* Effect.tryPromise(() =>
        openid.authorizationCodeGrant(config, callbackUrl, {
          expectedState,
          pkceCodeVerifier: codeVerifier,
        }),
      );

      const claims = yield* Effect.fromOption(decodeClaims(tokens.claims())).pipe(
        Effect.mapError(
          () =>
            new CustomHttpApiError.Unauthorized({
              message: "OIDC code exchange failed: id_token missing subject",
            }),
        ),
      );

      return toExchangeResult(claims, Option.fromUndefinedOr(tokens.id_token));
    }).pipe(
      Effect.catchTag("UnknownError", (error) =>
        Effect.fail(
          new CustomHttpApiError.Unauthorized({ message: describeExchangeFailure(error.cause) }),
        ),
      ),
    );

  const buildEndSessionUrl = (
    idTokenHint: Option.Option<string>,
  ): Effect.Effect<URL, CustomHttpApiError.InternalServerError> =>
    Effect.map(getConfig, (config) => {
      const parameters = new URLSearchParams({
        post_logout_redirect_uri: env.IDENTITY_POST_LOGOUT_REDIRECT_URI,
        client_id: env.IDENTITY_CLIENT_ID,
      });

      if (Option.isSome(idTokenHint)) parameters.set("id_token_hint", idTokenHint.value);

      return openid.buildEndSessionUrl(config, parameters);
    }).pipe(
      Effect.mapError(
        (error) =>
          new CustomHttpApiError.InternalServerError({
            message: `Failed to build end session URL: ${String(error.cause)}`,
          }),
      ),
    );

  return { buildAuthorize, exchangeCode, buildEndSessionUrl } as const;
});

export class OidcClient extends Context.Service<
  OidcClient,
  Effect.Success<ReturnType<typeof make>>
>()("OidcClient") {
  public static readonly layer = Layer.effect(OidcClient, make()).pipe(
    Layer.provide(EnvVars.layer),
  );
}
