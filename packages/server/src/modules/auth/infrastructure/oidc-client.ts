import { EnvVars } from "@/common/env-vars.js";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as openid from "openid-client";

// Wraps openid-client. The only file in the repo that imports `openid-client`.
// Used exclusively by the auth login + callback paths — once we have a
// session row, we don't talk to Zitadel again until the next login.

export type AuthorizeRequest = {
  readonly url: URL;
  readonly state: string;
  readonly codeVerifier: string;
};

export type CodeExchangeResult = {
  readonly subject: string;
  readonly email: string | null;
};

export class OidcClient extends Effect.Service<OidcClient>()("OidcClient", {
  accessors: true,
  effect: Effect.gen(function* () {
    const env = yield* EnvVars;
    const issuerUrl = new URL(env.ZITADEL_ISSUER);
    const allowHttp = issuerUrl.protocol === "http:";

    // Lazy discovery — fetched on first use, cached afterward. This lets the
    // server boot when Zitadel is briefly unreachable (and lets tests build
    // without a live Zitadel).
    let cached: openid.Configuration | null = null;
    const getConfig = async (): Promise<openid.Configuration> => {
      if (cached !== null) return cached;
      cached = await openid.discovery(
        issuerUrl,
        env.ZITADEL_CLIENT_ID,
        Redacted.value(env.ZITADEL_CLIENT_SECRET),
        undefined,
        allowHttp ? { execute: [openid.allowInsecureRequests] } : undefined,
      );
      return cached;
    };

    const buildAuthorize = (): Effect.Effect<
      AuthorizeRequest,
      CustomHttpApiError.InternalServerError
    > =>
      Effect.tryPromise({
        try: async () => {
          const config = await getConfig();
          const codeVerifier = openid.randomPKCECodeVerifier();
          const codeChallenge = await openid.calculatePKCECodeChallenge(codeVerifier);
          const state = openid.randomState();
          const url = openid.buildAuthorizationUrl(config, {
            redirect_uri: env.ZITADEL_REDIRECT_URI,
            scope: "openid email profile offline_access",
            code_challenge: codeChallenge,
            code_challenge_method: "S256",
            state,
            // Skip Zitadel's account picker. Without `id_token_hint` on
            // logout (we discard the id_token at callback time), Zitadel
            // can still surface previously-signed-in accounts (e.g. the
            // IAM-level `zitadel-admin@zitadel.localhost` from the PAT
            // bootstrap step). `prompt=login` forces the login form, which
            // is the expected post-logout UX.
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
          if (claims === undefined || typeof claims.sub !== "string") {
            throw new Error("id_token missing subject");
          }
          const email =
            typeof (claims as { email?: unknown }).email === "string"
              ? ((claims as { email?: string }).email ?? null)
              : null;
          return { subject: claims.sub, email };
        },
        catch: (cause) =>
          new CustomHttpApiError.Unauthorized({
            message: `OIDC code exchange failed: ${String(cause)}`,
          }),
      });

    const buildEndSessionUrl = (): Effect.Effect<URL, CustomHttpApiError.InternalServerError> =>
      Effect.tryPromise({
        try: async () => {
          const config = await getConfig();
          return openid.buildEndSessionUrl(config, {
            post_logout_redirect_uri: env.ZITADEL_POST_LOGOUT_REDIRECT_URI,
          });
        },
        catch: (cause) =>
          new CustomHttpApiError.InternalServerError({
            message: `Failed to build end session URL: ${String(cause)}`,
          }),
      });

    return { buildAuthorize, exchangeCode, buildEndSessionUrl } as const;
  }),
  dependencies: [EnvVars.Default],
}) {}
