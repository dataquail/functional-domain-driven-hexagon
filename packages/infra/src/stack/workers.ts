import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";

import { kindOfStage, PRODUCTION_STAGE, workerName, type WorkerRole } from "../stage.js";
import { appDatabase, identityDatabase } from "./databases.js";
import { deployedHosts, stageUrls } from "./hosts.js";
import { domainEventsDeadLetterQueue, domainEventsQueue } from "./queues.js";

const IDENTITY_WORKER_ENTRY = decodeURIComponent(
  new URL("../../../identity/src/platform/worker/identity-worker.ts", import.meta.url).pathname,
);

const SERVER_WORKER_ENTRY = decodeURIComponent(
  new URL("../../../server/src/platform/worker/main.ts", import.meta.url).pathname,
);

const WEB_ROOT = decodeURIComponent(new URL("../../../web-svelte/", import.meta.url).pathname);

const WEB_DEV_PORT = 3000;
const IDENTITY_DEV_PORT = 3002;
const SERVER_DEV_PORT = 3001;

// The server Worker's `scheduled` handler dispatches on these strings.
const HOURLY = "0 * * * *";
const EVERY_MINUTE = "* * * * *";

// CPU per invocation, the ceiling on what one request can cost. The identity
// Worker hashes passwords, which is the most expensive thing any of them does.
const CPU_MS: Record<WorkerRole, number> = { web: 200, identity: 1_000, server: 100 };

// Beside the Neon region (databases.ts): both Workers make several round trips per request.
const NEAR_THE_DATABASE = { region: "aws:us-east-2" };

const DEPLOYED_OBSERVABILITY = {
  enabled: true,
  logs: { enabled: true, invocationLogs: true },
  traces: { enabled: true },
};

// What a Worker is called, where it runs and what it may spend, on a deployed stage.
const deployedPlatform = Effect.fn(function* (role: WorkerRole) {
  if (yield* Alchemy.ALCHEMY_DEV) return { limits: { cpuMs: CPU_MS[role] } };
  const { stage } = yield* Alchemy.Stack;
  return {
    name: workerName(stage, role),
    limits: { cpuMs: CPU_MS[role] },
    observability: DEPLOYED_OBSERVABILITY,
    ...(role === "web" ? {} : { placement: NEAR_THE_DATABASE }),
  };
});

// A long-lived stage answers only on its custom domain, behind the zone's WAF rules;
// a preview, having no domain, answers on workers.dev.
const publicSurface = Effect.fn(function* (role: "web" | "identity") {
  if (yield* Alchemy.ALCHEMY_DEV) return {};
  const { stage } = yield* Alchemy.Stack;
  if (kindOfStage(stage) === "preview") return { workersDev: true };
  const hosts = yield* deployedHosts;
  const name = role === "web" ? hosts.appHostname : hosts.identityHostname;
  return { workersDev: false, ...(name === undefined ? {} : { domain: name }) };
});

const mailDailyCap = Config.Int("MAIL_DAILY_CAP").pipe(Config.withDefault(200), Config.map(String));

const mailSender = Effect.gen(function* () {
  return {
    IDENTITY_MAIL_FROM_ADDRESS: yield* Config.String("IDENTITY_MAIL_FROM_ADDRESS").pipe(
      Config.withDefault("noreply@localhost"),
    ),
    IDENTITY_MAIL_FROM_NAME: yield* Config.String("IDENTITY_MAIL_FROM_NAME").pipe(
      Config.withDefault("Effect Monorepo"),
    ),
  };
});

// Locally the Email binding only writes .eml files; Mailpit is where a developer reads mail.
const mailTransport = Effect.fn(function* (senderAddress: string) {
  if (yield* Alchemy.ALCHEMY_DEV) {
    return {
      IDENTITY_MAILER: "mailpit",
      MAILPIT_URL: yield* Config.String("MAILPIT_URL").pipe(
        Config.withDefault("http://localhost:8025"),
      ),
    };
  }
  return {
    IDENTITY_MAILER: "cloudflare",
    MAIL_DAILY_CAP: yield* mailDailyCap,
    EMAIL: yield* Cloudflare.Email.SendEmail("identity-email", {
      allowedSenderAddresses: [senderAddress],
    }),
  };
});

const seedToken = Effect.gen(function* () {
  const token = yield* Config.option(
    Config.NonEmptyString("IDENTITY_SEED_TOKEN").pipe(Config.map(Redacted.make)),
  );
  return Option.match(token, {
    onNone: () => ({}),
    onSome: (value) => ({ IDENTITY_SEED_TOKEN: value }),
  });
});

export const identityWorker = Effect.gen(function* () {
  const sender = yield* mailSender;
  const urls = yield* stageUrls;
  return yield* Cloudflare.Worker("identity", {
    main: IDENTITY_WORKER_ENTRY,
    dev: { port: IDENTITY_DEV_PORT, strictPort: true },
    ...(yield* deployedPlatform("identity")),
    ...(yield* publicSurface("identity")),
    env: {
      IDENTITY_DB: yield* identityDatabase,
      BETTER_AUTH_SECRET: yield* Config.Redacted("BETTER_AUTH_SECRET"),
      IDENTITY_BASE_URL: urls.IDENTITY_BASE_URL,
      APP_URL: urls.APP_URL,
      ...sender,
      ...(yield* mailTransport(sender.IDENTITY_MAIL_FROM_ADDRESS)),
      ...(yield* seedToken),
    },
  });
});

const serverMailer = Effect.fn(function* () {
  const sender = {
    MAIL_FROM_ADDRESS: yield* Config.String("MAIL_FROM_ADDRESS").pipe(
      Config.withDefault("noreply@localhost"),
    ),
    MAIL_FROM_NAME: yield* Config.String("MAIL_FROM_NAME").pipe(
      Config.withDefault("Effect Monorepo"),
    ),
  };
  if (yield* Alchemy.ALCHEMY_DEV) {
    return {
      ...sender,
      MAILER: "mailpit",
      MAILPIT_URL: yield* Config.String("MAILPIT_URL").pipe(
        Config.withDefault("http://localhost:8025"),
      ),
    };
  }
  return {
    ...sender,
    MAILER: "cloudflare",
    MAIL_DAILY_CAP: yield* mailDailyCap,
    EMAIL: yield* Cloudflare.Email.SendEmail("server-email", {
      allowedSenderAddresses: [sender.MAIL_FROM_ADDRESS],
    }),
  };
});

// Spans export to the local Jaeger only; a deployed stage has Workers Observability instead.
const serverTracing = Effect.gen(function* () {
  if (!(yield* Alchemy.ALCHEMY_DEV)) return {};
  return {
    OTLP_URL: yield* Config.String("OTLP_URL").pipe(
      Config.withDefault("http://localhost:4318/v1/traces"),
    ),
  };
});

// No public route in production: the web Worker reaches it over a service binding.
const serverSurface = Effect.gen(function* () {
  if (yield* Alchemy.ALCHEMY_DEV) return {};
  const { stage } = yield* Alchemy.Stack;
  return { workersDev: stage !== PRODUCTION_STAGE };
});

export const serverWorker = Effect.fn(function* (identity: Cloudflare.Worker) {
  const deadLetters = yield* domainEventsDeadLetterQueue;
  const domainEvents = yield* domainEventsQueue;
  const urls = yield* stageUrls;
  const server = yield* Cloudflare.Worker("server", {
    main: SERVER_WORKER_ENTRY,
    dev: { port: SERVER_DEV_PORT, strictPort: true },
    crons: [HOURLY, EVERY_MINUTE],
    ...(yield* deployedPlatform("server")),
    ...(yield* serverSurface),
    env: {
      APP_DB: yield* appDatabase,
      IDENTITY: identity,
      DOMAIN_EVENTS: domainEvents,
      DOMAIN_EVENTS_DEAD_LETTER_QUEUE: deadLetters.queueName,
      APP_URL: urls.APP_URL,
      IDENTITY_ISSUER: urls.IDENTITY_ISSUER,
      ...("IDENTITY_REDIRECT_URI" in urls
        ? { IDENTITY_REDIRECT_URI: urls.IDENTITY_REDIRECT_URI }
        : {}),
      ...("IDENTITY_POST_LOGOUT_REDIRECT_URI" in urls
        ? { IDENTITY_POST_LOGOUT_REDIRECT_URI: urls.IDENTITY_POST_LOGOUT_REDIRECT_URI }
        : {}),
      IDENTITY_CLIENT_ID: yield* Config.String("IDENTITY_CLIENT_ID"),
      IDENTITY_CLIENT_SECRET: yield* Config.Redacted("IDENTITY_CLIENT_SECRET"),
      SESSION_COOKIE_SECRET: yield* Config.Redacted("SESSION_COOKIE_SECRET"),
      STRIPE_SECRET_KEY: yield* Config.Redacted("STRIPE_SECRET_KEY"),
      STRIPE_WEBHOOK_SECRET: yield* Config.Redacted("STRIPE_WEBHOOK_SECRET"),
      STRIPE_PRICE_ID_DEFAULT: yield* Config.String("STRIPE_PRICE_ID_DEFAULT"),
      ...(yield* serverMailer()),
      ...(yield* serverTracing),
    },
  });
  yield* Cloudflare.Queues.Consumer("domain-events-consumer", {
    queueId: domainEvents.queueId,
    scriptName: server.workerName,
    deadLetterQueue: deadLetters.queueName,
    settings: { batchSize: 10, maxRetries: 10 },
  });
  yield* Cloudflare.Queues.Consumer("domain-events-dead-letter-consumer", {
    queueId: deadLetters.queueId,
    scriptName: server.workerName,
    settings: { batchSize: 10, maxRetries: 3 },
  });
  return server;
});

export const webWorker = Effect.fn(function* (server: Cloudflare.Worker) {
  return yield* Cloudflare.Website.SvelteKit("web", {
    rootDir: WEB_ROOT,
    dev: { port: WEB_DEV_PORT, strictPort: true },
    ...(yield* deployedPlatform("web")),
    ...(yield* publicSurface("web")),
    env: { SERVER: server },
  });
});
