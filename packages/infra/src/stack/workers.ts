import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { appDatabase, identityDatabase } from "./databases.js";
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
    EMAIL: yield* Cloudflare.Email.SendEmail("identity-email", {
      allowedSenderAddresses: [senderAddress],
    }),
  };
});

const seedToken = Effect.gen(function* () {
  const token = yield* Config.option(Config.Redacted("IDENTITY_SEED_TOKEN"));
  return Option.match(token, {
    onNone: () => ({}),
    onSome: (value) => ({ IDENTITY_SEED_TOKEN: value }),
  });
});

export const identityWorker = Effect.gen(function* () {
  const sender = yield* mailSender;
  return yield* Cloudflare.Worker("identity", {
    main: IDENTITY_WORKER_ENTRY,
    dev: { port: IDENTITY_DEV_PORT, strictPort: true },
    env: {
      IDENTITY_DB: yield* identityDatabase,
      BETTER_AUTH_SECRET: yield* Config.Redacted("BETTER_AUTH_SECRET"),
      IDENTITY_BASE_URL: yield* Config.String("IDENTITY_BASE_URL"),
      APP_URL: yield* Config.String("APP_URL"),
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
    EMAIL: yield* Cloudflare.Email.SendEmail("server-email", {
      allowedSenderAddresses: [sender.MAIL_FROM_ADDRESS],
    }),
  };
});

// Spans export to the local Jaeger only; deployed stages export nothing until a collector is chosen.
const serverTracing = Effect.gen(function* () {
  if (!(yield* Alchemy.ALCHEMY_DEV)) return {};
  return {
    OTLP_URL: yield* Config.String("OTLP_URL").pipe(
      Config.withDefault("http://localhost:4318/v1/traces"),
    ),
  };
});

const optionalString = Effect.fn(function* (name: string) {
  const value = yield* Config.option(Config.String(name));
  return Option.match(value, { onNone: () => ({}), onSome: (set) => ({ [name]: set }) });
});

export const serverWorker = Effect.fn(function* (identity: Cloudflare.Worker) {
  const { stage } = yield* Alchemy.Stack;
  const deadLetters = yield* domainEventsDeadLetterQueue;
  const domainEvents = yield* domainEventsQueue;
  const server = yield* Cloudflare.Worker("server", {
    main: SERVER_WORKER_ENTRY,
    dev: { port: SERVER_DEV_PORT, strictPort: true },
    crons: [HOURLY, EVERY_MINUTE],
    // No public route in production: the web Worker reaches it over a service binding.
    workersDev: stage !== "prod",
    limits: { cpuMs: 100 },
    env: {
      APP_DB: yield* appDatabase,
      IDENTITY: identity,
      DOMAIN_EVENTS: domainEvents,
      DOMAIN_EVENTS_DEAD_LETTER_QUEUE: deadLetters.queueName,
      APP_URL: yield* Config.String("APP_URL"),
      IDENTITY_ISSUER: yield* Config.String("IDENTITY_ISSUER"),
      IDENTITY_CLIENT_ID: yield* Config.String("IDENTITY_CLIENT_ID"),
      IDENTITY_CLIENT_SECRET: yield* Config.Redacted("IDENTITY_CLIENT_SECRET"),
      SESSION_COOKIE_SECRET: yield* Config.Redacted("SESSION_COOKIE_SECRET"),
      STRIPE_SECRET_KEY: yield* Config.Redacted("STRIPE_SECRET_KEY"),
      STRIPE_WEBHOOK_SECRET: yield* Config.Redacted("STRIPE_WEBHOOK_SECRET"),
      STRIPE_PRICE_ID_DEFAULT: yield* Config.String("STRIPE_PRICE_ID_DEFAULT"),
      ...(yield* optionalString("IDENTITY_REDIRECT_URI")),
      ...(yield* optionalString("IDENTITY_POST_LOGOUT_REDIRECT_URI")),
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

// Until the Next renderer is deleted, `WEB_RENDERER=next` leaves :3000 to it;
// `WEB_RENDERER=svelte` serves the SvelteKit app there instead.
export const webWorker = Effect.fn(function* (server: Cloudflare.Worker) {
  const renderer = yield* Config.Literals(["svelte", "next"], "WEB_RENDERER").pipe(
    Config.withDefault("next"),
  );
  if (renderer === "next") return Option.none<Cloudflare.Worker>();
  const domain = yield* Config.option(Config.String("WEB_DOMAIN"));
  return Option.some(
    yield* Cloudflare.Website.SvelteKit("web", {
      rootDir: WEB_ROOT,
      dev: { port: WEB_DEV_PORT, strictPort: true },
      ...Option.match(domain, { onNone: () => ({}), onSome: (name) => ({ domain: name }) }),
      env: { SERVER: server },
    }),
  );
});
