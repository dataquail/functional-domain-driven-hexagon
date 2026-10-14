import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Arr from "effect/Array";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { authRateLimitRule, type EdgeHostnames, killSwitchRule } from "../edge-rules.js";
import { PRODUCTION_STAGE, stageHosts } from "../stage.js";

// Staging lives in the production zone, and a ruleset owns its whole phase, so
// the prod stage declares the zone's rules for both.
const ZONE_STAGES = [PRODUCTION_STAGE, "staging"];

const zoneHostnames = (appDomain: string) =>
  Effect.gen(function* () {
    const hosts = yield* Effect.forEach(ZONE_STAGES, (stage) =>
      Effect.orDie(
        Effect.fromResult(
          stageHosts(stage, { appDomain: Option.some(appDomain), workersSubdomain: Option.none() }),
        ),
      ),
    );

    const hostnames: EdgeHostnames = {
      app: Arr.getSomes(hosts.map(({ appHostname }) => appHostname)),
      identity: Arr.getSomes(hosts.map(({ identityHostname }) => identityHostname)),
    };

    return hostnames;
  });

const usageAlertWebhook = Effect.gen(function* () {
  const url = yield* Config.option(Config.NonEmptyString("USAGE_ALERT_WEBHOOK_URL"));

  if (Option.isNone(url)) return [];

  const webhook = yield* Cloudflare.Alerting.NotificationWebhook("usage-alert-webhook", {
    url: url.value,
    secret: yield* Config.Redacted("USAGE_ALERT_WEBHOOK_SECRET"),
  });

  return [{ id: webhook.webhookId }];
});

const usageAlert = Effect.gen(function* () {
  return yield* Cloudflare.Alerting.NotificationPolicy("usage-alert", {
    alertType: "billing_usage_alert",
    description: "Usage past the threshold: consider engaging the kill switch",
    mechanisms: {
      email: [{ id: yield* Config.String("USAGE_ALERT_EMAIL") }],
      webhooks: yield* usageAlertWebhook,
    },
    filters: {
      product: [yield* Config.String("USAGE_ALERT_PRODUCT")],
      limit: [yield* Config.String("USAGE_ALERT_LIMIT")],
    },
  });
});

// Production only: the zone's rate limits, the kill switch, and the usage alert.
export const edge = Effect.gen(function* () {
  if (yield* Alchemy.ALCHEMY_DEV) return Option.none();
  const { stage } = yield* Alchemy.Stack;

  if (stage !== PRODUCTION_STAGE) return Option.none();
  const appDomain = yield* Config.String("APP_DOMAIN");
  const hostnames = yield* zoneHostnames(appDomain);
  const killSwitchEngaged = yield* Config.Boolean("KILL_SWITCH").pipe(Config.withDefault(false));

  // The zone is adopted, never created, and outlives every stack that names it.
  const zone = yield* Cloudflare.Zone.Zone("zone", { name: appDomain }).pipe(
    Alchemy.AdoptPolicy.adopt(true),
    Alchemy.RemovalPolicy.retain(),
  );

  yield* Cloudflare.Ruleset.Ruleset("auth-rate-limits", {
    zone,
    phase: "http_ratelimit",
    rules: [authRateLimitRule(hostnames)],
  });
  yield* Cloudflare.Ruleset.Ruleset("kill-switch", {
    zone,
    phase: "http_request_firewall_custom",
    rules: [killSwitchRule(hostnames, killSwitchEngaged)],
  });
  yield* usageAlert;

  return Option.some({ killSwitchEngaged });
});
