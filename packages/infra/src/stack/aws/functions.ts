import * as Alchemy from "alchemy";
import * as AWS from "alchemy/AWS";
import * as Output from "alchemy/Output";
import * as Config from "effect/Config";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";

import { SCHEDULED_JOBS, scheduledJobInput } from "../../aws-stage";
import { workerName } from "../../stage";
import { appDatabaseUrls, identityDatabaseUrls } from "./databases";
import { awsHostnames, awsUrls, hostedZoneId } from "./hosts";
import { domainEventsDeadLetterQueue, domainEventsQueue, SERVER_TIMEOUT_SECONDS } from "./queues";

const besideThisFile = Effect.fn("besideThisFile")(function* (relative: string) {
  const path = yield* Path.Path;

  return yield* Effect.orDie(path.fromFileUrl(new URL(relative, import.meta.url)));
});

const SERVER_LAMBDA_ENTRY = besideThisFile("../../../../server/src/platform/lambda/main.ts");

const IDENTITY_LAMBDA_ENTRY = besideThisFile(
  "../../../../identity/src/platform/lambda/identity-lambda.ts",
);

const WEB_ROOT = besideThisFile("../../../../web/");

// Lambda allots CPU in proportion to memory; the issuer's password hashing sets the floor.
const MEMORY_MB = 1024;

const BUFFERED_PUBLIC_URL = { authType: "NONE", invokeMode: "BUFFERED" } as const;

// A Lambda's env is plain text at rest under the account's key, so a secret is
// unwrapped where it is handed to one.
const secret = (name: string) => Config.Redacted(name).pipe(Config.map(Redacted.value));

const mailDailyCap = Config.Int("MAIL_DAILY_CAP").pipe(Config.withDefault(200), Config.map(String));

const lambdaName = Effect.fn("lambdaName")(function* (role: "server" | "identity") {
  const { stage } = yield* Alchemy.Stack;

  return workerName(stage, role);
});

// In SES's sandbox a send is also authorised against each recipient's identity,
// so the grant covers the account's identities in the region, not only the sender's.
const sendEmailPolicy = (identityArn: Output.Output<string>) => ({
  Effect: "Allow" as const,
  Action: ["ses:SendEmail"],
  Resource: [Output.map(identityArn, (arn: string) => arn.replace(/identity\/.*$/, "identity/*"))],
});

const seedToken = Effect.gen(function* () {
  const token = yield* Config.option(Config.NonEmptyString("IDENTITY_SEED_TOKEN"));

  return Option.match(token, {
    onNone: () => ({}),
    onSome: (value) => ({ IDENTITY_SEED_TOKEN: value }),
  });
});

export const identityFunction = Effect.fn("identityFunction")(function* (
  mail: AWS.SES.EmailIdentity,
) {
  const urls = yield* awsUrls;
  const database = yield* identityDatabaseUrls;

  const fn = yield* AWS.Lambda.Function("identity", {
    main: yield* IDENTITY_LAMBDA_ENTRY,
    handler: "handler",
    functionName: yield* lambdaName("identity"),
    runtime: "nodejs24.x",
    architecture: "arm64",
    memorySize: MEMORY_MB,
    timeout: Duration.seconds(30),
    functionUrl: BUFFERED_PUBLIC_URL,
    env: {
      IDENTITY_DATABASE_URL: database.pooled,
      BETTER_AUTH_SECRET: yield* secret("BETTER_AUTH_SECRET"),
      IDENTITY_BASE_URL: urls.IDENTITY_BASE_URL,
      APP_URL: urls.APP_URL,
      IDENTITY_MAILER: "ses",
      IDENTITY_MAIL_FROM_ADDRESS: yield* Config.String("IDENTITY_MAIL_FROM_ADDRESS"),
      IDENTITY_MAIL_FROM_NAME: yield* Config.String("IDENTITY_MAIL_FROM_NAME").pipe(
        Config.withDefault("Effect Monorepo"),
      ),
      MAIL_DAILY_CAP: yield* mailDailyCap,
      ...(yield* seedToken),
    },
  });

  yield* fn.bind`Allow(${fn}, AWS.SES.SendEmail(${mail}))`({
    policyStatements: [sendEmailPolicy(mail.identityArn)],
  });

  return fn;
});

// The issuer answers on its own subdomain through CloudFront, so the URL it signs
// tokens for is known before it is deployed.
export const identitySite = Effect.fn("identitySite")(function* (fn: AWS.Lambda.Function) {
  const hostnames = yield* awsHostnames;

  return yield* AWS.Website.SsrSite("identity-site", {
    server: { type: "lambda", function: fn },
    domain: { name: hostnames.identity, hostedZoneId: yield* hostedZoneId },
  }).pipe(Effect.orDie);
});

const queuePolicies = (queue: AWS.SQS.Queue, deadLetters: AWS.SQS.Queue) => [
  {
    Effect: "Allow" as const,
    Action: ["sqs:SendMessage", "sqs:ChangeMessageVisibility"],
    Resource: [queue.queueArn],
  },
  {
    Effect: "Allow" as const,
    Action: ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"],
    Resource: [queue.queueArn, deadLetters.queueArn],
  },
];

// One rule per job; each sends the constant input the server dispatches on.
const scheduleJobs = Effect.fn("scheduleJobs")(function* (fn: AWS.Lambda.Function) {
  for (const { job, rule, schedule } of SCHEDULED_JOBS) {
    const trigger = yield* AWS.EventBridge.Rule(rule, {
      scheduleExpression: schedule,
      targets: [{ Id: "server", Arn: fn.functionArn, Input: scheduledJobInput(job) }],
    });

    yield* AWS.Lambda.Permission(`${rule}-invoke`, {
      action: "lambda:InvokeFunction",
      functionName: fn.functionName,
      principal: "events.amazonaws.com",
      sourceArn: trigger.ruleArn,
    });
  }
});

const consumeQueues = Effect.fn("consumeQueues")(function* (
  fn: AWS.Lambda.Function,
  queue: AWS.SQS.Queue,
  deadLetters: AWS.SQS.Queue,
) {
  yield* AWS.Lambda.EventSourceMapping("domain-events-consumer", {
    functionName: fn.functionName,
    eventSourceArn: queue.queueArn,
    batchSize: 10,
    functionResponseTypes: ["ReportBatchItemFailures"],
  });
  yield* AWS.Lambda.EventSourceMapping("domain-events-dead-letter-consumer", {
    functionName: fn.functionName,
    eventSourceArn: deadLetters.queueArn,
    batchSize: 10,
    functionResponseTypes: ["ReportBatchItemFailures"],
  });
});

// One function serves the API's Function URL, both queues and the schedule rules.
// The web function reaches it at its Function URL; the browser only through /api.
export const serverFunction = Effect.fn("serverFunction")(function* (mail: AWS.SES.EmailIdentity) {
  const urls = yield* awsUrls;
  const database = yield* appDatabaseUrls;
  const queue = yield* domainEventsQueue;
  const deadLetters = yield* domainEventsDeadLetterQueue;

  const fn = yield* AWS.Lambda.Function("server", {
    main: yield* SERVER_LAMBDA_ENTRY,
    handler: "handler",
    functionName: yield* lambdaName("server"),
    runtime: "nodejs24.x",
    architecture: "arm64",
    memorySize: MEMORY_MB,
    timeout: Duration.seconds(SERVER_TIMEOUT_SECONDS),
    functionUrl: BUFFERED_PUBLIC_URL,
    env: {
      DATABASE_URL: database.pooled,
      DATABASE_SSL: "true",
      DOMAIN_EVENTS_QUEUE_URL: queue.queueUrl,
      DOMAIN_EVENTS_DEAD_LETTER_QUEUE_ARN: deadLetters.queueArn,
      APP_URL: urls.APP_URL,
      IDENTITY_ISSUER: urls.IDENTITY_ISSUER,
      IDENTITY_REDIRECT_URI: urls.IDENTITY_REDIRECT_URI,
      IDENTITY_POST_LOGOUT_REDIRECT_URI: urls.IDENTITY_POST_LOGOUT_REDIRECT_URI,
      IDENTITY_CLIENT_ID: yield* Config.String("IDENTITY_CLIENT_ID"),
      IDENTITY_CLIENT_SECRET: yield* secret("IDENTITY_CLIENT_SECRET"),
      SESSION_COOKIE_SECRET: yield* secret("SESSION_COOKIE_SECRET"),
      STRIPE_SECRET_KEY: yield* secret("STRIPE_SECRET_KEY"),
      STRIPE_WEBHOOK_SECRET: yield* secret("STRIPE_WEBHOOK_SECRET"),
      STRIPE_PRICE_ID_DEFAULT: yield* Config.String("STRIPE_PRICE_ID_DEFAULT"),
      MAILER: "ses",
      MAIL_FROM_ADDRESS: yield* Config.String("MAIL_FROM_ADDRESS"),
      MAIL_FROM_NAME: yield* Config.String("MAIL_FROM_NAME").pipe(
        Config.withDefault("Effect Monorepo"),
      ),
      MAIL_DAILY_CAP: yield* mailDailyCap,
    },
  });

  yield* fn.bind`Allow(${fn}, AWS.SQS.DomainEvents(${queue}, ${deadLetters}))`({
    policyStatements: queuePolicies(queue, deadLetters),
  });
  yield* fn.bind`Allow(${fn}, AWS.SES.SendEmail(${mail}))`({
    policyStatements: [sendEmailPolicy(mail.identityArn)],
  });
  yield* consumeQueues(fn, queue, deadLetters);
  yield* scheduleJobs(fn);

  return { fn, queue, deadLetters };
});

export const webSite = Effect.fn("webSite")(function* (server: AWS.Lambda.Function) {
  const hostnames = yield* awsHostnames;

  return yield* AWS.Website.SvelteKit("web", {
    rootDir: yield* WEB_ROOT,
    memorySize: MEMORY_MB,
    architecture: "arm64",
    env: { SERVER_URL: server.functionUrl },
    domain: { name: hostnames.app, hostedZoneId: yield* hostedZoneId },
  });
});
