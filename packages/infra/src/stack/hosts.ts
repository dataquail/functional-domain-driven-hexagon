import * as Alchemy from "alchemy";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import {
  appCallbackUrl,
  appSignedOutUrl,
  identityIssuer,
  type StageHosts,
  stageHosts,
} from "../stage.js";

const optional = (name: string) =>
  Config.option(Config.String(name)).pipe(Effect.map(Option.getOrUndefined));

export const deployedHosts: Effect.Effect<StageHosts, Config.ConfigError, Alchemy.Stack> =
  Effect.gen(function* () {
    const { stage } = yield* Alchemy.Stack;
    return stageHosts(stage, {
      appDomain: yield* optional("APP_DOMAIN"),
      workersSubdomain: yield* optional("CLOUDFLARE_WORKERS_SUBDOMAIN"),
    });
  });

const devUrls = Effect.gen(function* () {
  const redirectUri = yield* optional("IDENTITY_REDIRECT_URI");
  const signedOutUri = yield* optional("IDENTITY_POST_LOGOUT_REDIRECT_URI");
  return {
    APP_URL: yield* Config.String("APP_URL"),
    IDENTITY_BASE_URL: yield* Config.String("IDENTITY_BASE_URL"),
    IDENTITY_ISSUER: yield* Config.String("IDENTITY_ISSUER"),
    ...(redirectUri === undefined ? {} : { IDENTITY_REDIRECT_URI: redirectUri }),
    ...(signedOutUri === undefined ? {} : { IDENTITY_POST_LOGOUT_REDIRECT_URI: signedOutUri }),
  };
});

// Locally the URLs come from .env; a deployed stage derives every one from its hosts.
export const stageUrls = Effect.gen(function* () {
  if (yield* Alchemy.ALCHEMY_DEV) return yield* devUrls;
  const hosts = yield* deployedHosts;
  return {
    APP_URL: hosts.appUrl,
    IDENTITY_BASE_URL: hosts.identityUrl,
    IDENTITY_ISSUER: identityIssuer(hosts),
    IDENTITY_REDIRECT_URI: appCallbackUrl(hosts),
    IDENTITY_POST_LOGOUT_REDIRECT_URI: appSignedOutUrl(hosts),
  };
});
