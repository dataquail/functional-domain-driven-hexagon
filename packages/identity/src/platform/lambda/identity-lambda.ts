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
import { emailBindingMailer } from "../../mail/email-binding-mailer";
import type { MailSender } from "../../mail/identity-mailer";
import { mailpitMailer } from "../../mail/mailpit-mailer";
import { deliveryThroughSes } from "../../mail/ses-delivery";
import {
  FunctionUrlEvent,
  type FunctionUrlResult,
  toFunctionUrlResult,
  toRequest,
} from "./function-url";

const IdentityLambdaEnv = Schema.Struct({
  IDENTITY_DATABASE_URL: Schema.String,
  BETTER_AUTH_SECRET: Schema.String,
  IDENTITY_BASE_URL: Schema.String,
  APP_URL: Schema.String,
  IDENTITY_MAILER: Schema.Literals(["mailpit", "ses"]),
  IDENTITY_MAIL_FROM_ADDRESS: Schema.String,
  IDENTITY_MAIL_FROM_NAME: Schema.String,
  MAILPIT_URL: Schema.optional(Schema.String),
  IDENTITY_SEED_TOKEN: Schema.optional(Schema.String),
  MAIL_DAILY_CAP: Schema.optional(Schema.String),
  AWS_ACCESS_KEY_ID: Schema.optional(Schema.String),
  AWS_SECRET_ACCESS_KEY: Schema.optional(Schema.String),
  AWS_SESSION_TOKEN: Schema.optional(Schema.String),
  AWS_REGION: Schema.optional(Schema.String),
});

type IdentityLambdaEnv = typeof IdentityLambdaEnv.Type;

const DEFAULT_MAIL_DAILY_CAP = 200;

class IdentityLambdaMisconfigured extends Schema.TaggedError<
  IdentityLambdaMisconfigured,
  { readonly brand: "IdentityLambdaMisconfigured" }
>()("IdentityLambdaMisconfigured", { message: Schema.String }) {}

const requireSetting = <A>(value: Option.Option<A>, message: string) =>
  Option.match(value, {
    onNone: () => Effect.die(new IdentityLambdaMisconfigured({ message })),
    onSome: Effect.succeed,
  });

const mailDailyCap = (env: IdentityLambdaEnv): number =>
  Option.getOrElse(
    Option.map(Option.fromUndefinedOr(env.MAIL_DAILY_CAP), Number),
    () => DEFAULT_MAIL_DAILY_CAP,
  );

const sesCredentials = (env: IdentityLambdaEnv) =>
  Option.all({
    accessKeyId: Option.fromUndefinedOr(env.AWS_ACCESS_KEY_ID),
    secretAccessKey: Option.fromUndefinedOr(env.AWS_SECRET_ACCESS_KEY),
    region: Option.fromUndefinedOr(env.AWS_REGION),
  }).pipe(
    Option.map((required) => ({
      ...required,
      ...Option.match(Option.fromUndefinedOr(env.AWS_SESSION_TOKEN), {
        onNone: () => ({}),
        onSome: (sessionToken) => ({ sessionToken }),
      }),
    })),
  );

const mailerFor = Effect.fn("identity.mailerFor")(function* (
  env: IdentityLambdaEnv,
  database: pg.Pool,
) {
  const sender: MailSender = {
    address: env.IDENTITY_MAIL_FROM_ADDRESS,
    name: env.IDENTITY_MAIL_FROM_NAME,
  };

  const client = yield* HttpClient.HttpClient;

  if (env.IDENTITY_MAILER === "ses") {
    const credentials = yield* requireSetting(
      sesCredentials(env),
      "IDENTITY_MAILER=ses needs the execution role's AWS credentials",
    );

    return dailyCappedMailer(
      emailBindingMailer(deliveryThroughSes(credentials, client), sender),
      sendCountStoreIn(database),
      mailDailyCap(env),
    );
  }

  const url = yield* requireSetting(
    Option.fromUndefinedOr(env.MAILPIT_URL),
    "IDENTITY_MAILER=mailpit needs MAILPIT_URL",
  );

  return mailpitMailer({ url, sender, client });
});

// Settled one by one, as Promise.allSettled would: a failed task must not keep the pool open.
const settle = (tasks: ReadonlyArray<Promise<unknown>>) =>
  Effect.forEach(tasks, (task) => Effect.ignore(Effect.tryPromise(() => task)), { discard: true });

const respond = (env: IdentityLambdaEnv, request: Request) => {
  // Neon's pooler owns reuse; a pool that outlives the invocation would hold a frozen socket.
  const database = new pg.Pool({ connectionString: env.IDENTITY_DATABASE_URL, max: 1 });
  const backgroundTasks: Array<Promise<unknown>> = [];

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

  // Lambda freezes the process once the handler returns, so background work finishes first.
  const closeDatabase = settle(backgroundTasks).pipe(
    Effect.andThen(Effect.promise(() => database.end())),
  );

  return handle.pipe(Effect.ensuring(closeDatabase), Effect.provide(FetchHttpClient.layer));
};

const decodeEnv = Schema.decodeUnknownEffect(IdentityLambdaEnv);
const decodeEvent = Schema.decodeEffect(FunctionUrlEvent);

export const handler = (event: FunctionUrlEvent): Promise<FunctionUrlResult> =>
  Effect.runPromise(
    Effect.all({ env: decodeEnv(process.env), event: decodeEvent(event) }).pipe(
      Effect.orDie,
      Effect.flatMap(({ env, event: request }) => respond(env, toRequest(request))),
      Effect.flatMap(toFunctionUrlResult),
    ),
  );
