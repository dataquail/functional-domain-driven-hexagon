import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Predicate from "effect/Predicate";
import * as Redacted from "effect/Redacted";
import * as openid from "openid-client";

import { EnvVars } from "@/globals/infrastructure/config/env-vars.js";

// The only file in the repo that imports `openid-client`. Used by login, callback and
// logout alone: once a session row exists, the issuer is not consulted again.

export type AuthorizeRequest = {
  readonly url: URL;
  readonly state: string;
  readonly codeVerifier: string;
};

export type CodeExchangeResult = {
  readonly subject: string;
  readonly email: string | null;
  readonly emailVerified: boolean;
  readonly idToken: string | null;
};

// A Worker routes the token calls through its service binding instead of the network.
export type OidcTransport = {
  readonly fetch?: openid.CustomFetch;
};

const make = Effect.fn("OidcClient.make")(function* (transport: OidcTransport) {
  const env = yield* EnvVars;
  const issuerUrl = new URL(env.IDENTITY_ISSUER);
  const allowHttp = issuerUrl.protocol === "http:";

  // Discovered on first use, so the server boots while the issuer is unreachable.
  let cached: openid.Configuration | null = null;
  const getConfig = async (): Promise<openid.Configuration> => {
    if (cached !== null) return cached;
    cached = await openid.discovery(
      issuerUrl,
      env.IDENTITY_CLIENT_ID,
      Redacted.value(env.IDENTITY_CLIENT_SECRET),
      undefined,
      {
        ...(transport.fetch === undefined ? {} : { [openid.customFetch]: transport.fetch }),
        ...(allowHttp ? { execute: [openid.allowInsecureRequests] } : {}),
      },
    );
    if (transport.fetch !== undefined) cached[openid.customFetch] = transport.fetch;
    return cached;
  };

  const buildAuthorize: Effect.Effect<AuthorizeRequest, CustomHttpApiError.InternalServerError> =
    Effect.tryPromise({
      try: async () => {
        const config = await getConfig();
        const codeVerifier = openid.randomPKCECodeVerifier();
        const codeChallenge = await openid.calculatePKCECodeChallenge(codeVerifier);
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
      },
      catch: (cause) =>
        new CustomHttpApiError.InternalServerError({
          message: `Failed to build authorize URL: ${String(cause)}`,
        }),
    });

  const exchangeCode = (
    callbackUrl: URL,
    expectedState: string,
    codeVerifier: string,
  ): Effect.Effect<CodeExchangeResult, CustomHttpApiError.Unauthorized> =>
    Effect.tryPromise({
      try: async () => {
        const config = await getConfig();
        const tokens = await openid.authorizationCodeGrant(config, callbackUrl, {
          expectedState,
          pkceCodeVerifier: codeVerifier,
        });
        const claims = tokens.claims();
        if (claims === undefined || !Predicate.isString(claims.sub)) {
          throw new Error("id_token missing subject");
        }
        const email =
          Predicate.hasProperty(claims, "email") && Predicate.isString(claims.email)
            ? claims.email
            : null;
        const emailVerified =
          Predicate.hasProperty(claims, "email_verified") && claims.email_verified === true;
        return { subject: claims.sub, email, emailVerified, idToken: tokens.id_token ?? null };
      },
      catch: (cause) => {
        // openid-client carries the issuer's `error` / `error_description` on the
        // thrown value; without them every failure reads as one generic error.
        const field = (key: string): unknown =>
          Predicate.hasProperty(cause, key) ? cause[key] : undefined;
        const detail = [field("error"), field("error_description"), field("code")]
          .filter((v) => v !== undefined && v !== null && v !== "")
          .join(" — ");
        return new CustomHttpApiError.Unauthorized({
          message:
            detail !== ""
              ? `OIDC code exchange failed: ${String(cause)} [${detail}]`
              : `OIDC code exchange failed: ${String(cause)}`,
        });
      },
    });

  const buildEndSessionUrl = (
    idTokenHint: string | null,
  ): Effect.Effect<URL, CustomHttpApiError.InternalServerError> =>
    Effect.tryPromise({
      try: async () => {
        const config = await getConfig();
        return openid.buildEndSessionUrl(config, {
          post_logout_redirect_uri: env.IDENTITY_POST_LOGOUT_REDIRECT_URI,
          client_id: env.IDENTITY_CLIENT_ID,
          ...(idTokenHint === null ? {} : { id_token_hint: idTokenHint }),
        });
      },
      catch: (cause) =>
        new CustomHttpApiError.InternalServerError({
          message: `Failed to build end session URL: ${String(cause)}`,
        }),
    });

  return { buildAuthorize, exchangeCode, buildEndSessionUrl } as const;
});

export class OidcClient extends Context.Service<
  OidcClient,
  Effect.Success<ReturnType<typeof make>>
>()("OidcClient") {
  public static readonly layerWith = (transport: OidcTransport) =>
    Layer.effect(OidcClient, make(transport)).pipe(Layer.provide(EnvVars.layer));

  public static readonly layer = OidcClient.layerWith({});
}
