import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { identityDatabase } from "./databases.js";

const IDENTITY_WORKER_ENTRY = decodeURIComponent(
  new URL("../../../identity/src/platform/worker/identity-worker.ts", import.meta.url).pathname,
);

const IDENTITY_DEV_PORT = 3002;

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
