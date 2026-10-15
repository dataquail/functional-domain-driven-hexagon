import * as Alchemy from "alchemy";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

import {
  appCallbackUrl,
  appSignedOutUrl,
  domainHostnames,
  domainHosts,
  identityIssuer,
} from "../../stage";

const appDomain = Config.String("APP_DOMAIN");

// On AWS every stage answers on its own subdomain: a CloudFront URL is only known
// once its distribution exists, and the issuer must know its own URL before then.
export const awsHostnames = Effect.gen(function* () {
  const { stage } = yield* Alchemy.Stack;

  return domainHostnames(stage, yield* appDomain);
});

// The Route 53 zone of APP_DOMAIN, where every certificate is validated and every record lives.
export const hostedZoneId = Config.NonEmptyString("AWS_HOSTED_ZONE_ID");

export const awsUrls = Effect.gen(function* () {
  const { stage } = yield* Alchemy.Stack;
  const hosts = domainHosts(stage, yield* appDomain);

  return {
    APP_URL: hosts.appUrl,
    IDENTITY_BASE_URL: hosts.identityUrl,
    IDENTITY_ISSUER: identityIssuer(hosts),
    IDENTITY_REDIRECT_URI: appCallbackUrl(hosts),
    IDENTITY_POST_LOGOUT_REDIRECT_URI: appSignedOutUrl(hosts),
  };
});
