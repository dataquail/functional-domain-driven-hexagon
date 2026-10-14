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
} from "../stage.ts";

const optional = (name: string) => Config.option(Config.NonEmptyString(name));

// A stage deployed without its hosts' setting cannot be addressed at all.
export const deployedHosts: Effect.Effect<StageHosts, Config.ConfigError, Alchemy.Stack> =
  Effect.gen(function* () {
    const { stage } = yield* Alchemy.Stack;

    const hosts = stageHosts(stage, {
      appDomain: yield* optional("APP_DOMAIN"),
      workersSubdomain: yield* optional("CLOUDFLARE_WORKERS_SUBDOMAIN"),
    });

    return yield* Effect.orDie(Effect.fromResult(hosts));
  });

const devUrls = Effect.gen(function* () {
  return {
    APP_URL: yield* Config.String("APP_URL"),
    IDENTITY_BASE_URL: yield* Config.String("IDENTITY_BASE_URL"),
    IDENTITY_ISSUER: yield* Config.String("IDENTITY_ISSUER"),
    IDENTITY_REDIRECT_URI: yield* optional("IDENTITY_REDIRECT_URI"),
    IDENTITY_POST_LOGOUT_REDIRECT_URI: yield* optional("IDENTITY_POST_LOGOUT_REDIRECT_URI"),
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
    IDENTITY_REDIRECT_URI: Option.some(appCallbackUrl(hosts)),
    IDENTITY_POST_LOGOUT_REDIRECT_URI: Option.some(appSignedOutUrl(hosts)),
  };
});
