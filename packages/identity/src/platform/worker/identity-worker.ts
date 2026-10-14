import type { ExecutionContext, Hyperdrive, SendEmail } from "@cloudflare/workers-types";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import pg from "pg";

import { type ClientCredentials, identityAuthFor } from "../../auth/identity-auth";
import { betterAuthPort } from "../../auth/identity-auth-port";
import { handleIdentityRequest } from "../../http/identity-router";
import { dailyCappedMailer, sendCountStoreIn } from "../../mail/daily-capped-mailer";
import { deliveryThroughBinding, emailBindingMailer } from "../../mail/email-binding-mailer";
import type { MailSender } from "../../mail/identity-mailer";
import { mailpitMailer } from "../../mail/mailpit-mailer";

type IdentityWorkerEnv = {
  readonly IDENTITY_DB: Hyperdrive;
  readonly BETTER_AUTH_SECRET: string;
  readonly IDENTITY_BASE_URL: string;
  readonly APP_URL: string;
  readonly IDENTITY_MAILER: "mailpit" | "cloudflare";
  readonly IDENTITY_MAIL_FROM_ADDRESS: string;
  readonly IDENTITY_MAIL_FROM_NAME: string;
  readonly MAILPIT_URL?: string;
  readonly EMAIL?: SendEmail;
  readonly IDENTITY_SEED_TOKEN?: string;
  readonly MAIL_DAILY_CAP?: string;
};

const DEFAULT_MAIL_DAILY_CAP = 200;

class MailerMisconfigured extends Schema.TaggedError<
  MailerMisconfigured,
  { readonly brand: "MailerMisconfigured" }
>()("MailerMisconfigured", { message: Schema.String }) {}

const requireSetting = <A>(value: Option.Option<A>, message: string) =>
  Option.match(value, {
    onNone: () => Effect.die(new MailerMisconfigured({ message })),
    onSome: Effect.succeed,
  });

const mailDailyCap = (env: IdentityWorkerEnv): number =>
  Option.getOrElse(
    Option.map(Option.fromUndefinedOr(env.MAIL_DAILY_CAP), Number),
    () => DEFAULT_MAIL_DAILY_CAP,
  );

const mailerFor = Effect.fn("identity.mailerFor")(function* (
  env: IdentityWorkerEnv,
  database: pg.Pool,
) {
  const sender: MailSender = {
    address: env.IDENTITY_MAIL_FROM_ADDRESS,
    name: env.IDENTITY_MAIL_FROM_NAME,
  };

  if (env.IDENTITY_MAILER === "cloudflare") {
    const binding = yield* requireSetting(
      Option.fromUndefinedOr(env.EMAIL),
      "IDENTITY_MAILER=cloudflare needs the EMAIL binding",
    );

    return dailyCappedMailer(
      emailBindingMailer(deliveryThroughBinding(binding), sender),
      sendCountStoreIn(database),
      mailDailyCap(env),
    );
  }

  const url = yield* requireSetting(
    Option.fromUndefinedOr(env.MAILPIT_URL),
    "IDENTITY_MAILER=mailpit needs MAILPIT_URL",
  );

  return mailpitMailer({ url, sender, client: yield* HttpClient.HttpClient });
});

// Settled one by one, as Promise.allSettled would: a failed task must not keep the pool open.
const settle = (tasks: ReadonlyArray<Promise<unknown>>) =>
  Effect.forEach(tasks, (task) => Effect.ignore(Effect.tryPromise(() => task)), { discard: true });

export default {
  fetch(request: Request, env: IdentityWorkerEnv, ctx: ExecutionContext): Promise<Response> {
    // Hyperdrive pools connections itself; a pool that outlives the request would hold a dead socket.
    const database = new pg.Pool({ connectionString: env.IDENTITY_DB.connectionString, max: 1 });
    const backgroundTasks: Array<Promise<unknown>> = [];

    const closeDatabaseAfterBackgroundTasks = Effect.sync(() => {
      ctx.waitUntil(
        Effect.runPromise(
          settle(backgroundTasks).pipe(Effect.andThen(Effect.promise(() => database.end()))),
        ),
      );
    });

    const handle = Effect.gen(function* () {
      const mailer = yield* mailerFor(env, database);

      const settingsFor = (registerClientAs: Option.Option<ClientCredentials>) => ({
        baseUrl: env.IDENTITY_BASE_URL,
        secret: env.BETTER_AUTH_SECRET,
        appUrl: env.APP_URL,
        database,
        mailer,
        runInBackground: Option.some((task: Promise<unknown>) => {
          backgroundTasks.push(task);
        }),
        registerClientAs,
      });

      return yield* handleIdentityRequest(request, {
        auth: betterAuthPort(
          () => identityAuthFor(settingsFor(Option.none())),
          (client) => identityAuthFor({ ...settingsFor(client), sendVerificationOnSignUp: false }),
        ),
        appUrl: env.APP_URL,
        seedToken: Option.fromUndefinedOr(env.IDENTITY_SEED_TOKEN),
      });
    });

    return Effect.runPromise(
      handle.pipe(
        Effect.ensuring(closeDatabaseAfterBackgroundTasks),
        Effect.provide(FetchHttpClient.layer),
      ),
    );
  },
};
