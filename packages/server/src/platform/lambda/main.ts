import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { purgeExpiredSessions } from "@org/jobs/jobs/purge-expired-sessions";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { CookieCodec } from "@/globals/infrastructure/auth/cookie-codec";
import { type AwsCredentials, awsCredentialsFrom } from "@/globals/infrastructure/aws/aws-api";
import { changeMessageVisibility, sendMessageBatch } from "@/globals/infrastructure/aws/sqs-api";
import { EnvVars } from "@/globals/infrastructure/config/env-vars";
import {
  CommandBusLive,
  DomainEventBusLive,
  makeAfterCommitTransportLive,
  makeUnitOfWorkLive,
  QueryBusLive,
  UnhandledFailuresLive,
} from "@/globals/infrastructure/cqrs/cqrs-runtime";
import { DatabaseLive } from "@/globals/infrastructure/database/database-live";
import { DeliveryLedgerLive } from "@/globals/infrastructure/events/delivery-ledger-live";
import {
  consumeDomainEvents,
  reportDeadLetters,
} from "@/globals/infrastructure/events/domain-event-consumer";
import { sweepOutbox } from "@/globals/infrastructure/events/outbox-sweeper";
import { SqsDomainEventQueueLive } from "@/globals/infrastructure/events/sqs-domain-event-queue-live";
import { Api } from "@/globals/infrastructure/framework/http/api";
import { UserAuthMiddlewareLive } from "@/globals/infrastructure/framework/middlewares/auth-middleware-live";
import { applicationModules } from "@/globals/infrastructure/framework/modules/application-modules";
import { TracerLive } from "@/globals/infrastructure/observability/tracer-live";
import {
  ExecutionContext,
  makeWorkerExecutionContext,
} from "@/globals/infrastructure/runtime/execution-context";
import { BillingGatewayLive } from "@/modules/billing/billing.platform";
import {
  batchItemFailures,
  FunctionUrlEvent,
  type FunctionUrlResult,
  LambdaEvent,
  OUTBOX_SWEEP_JOB,
  type ScheduledJobEvent,
  SESSION_PURGE_JOB,
  SqsEvent,
  type SqsRetry,
  toFunctionUrlResult,
  toQueueMessages,
  toRequest,
} from "@/platform/lambda/lambda-events";

type LambdaEnv = NodeJS.ProcessEnv;

const LambdaSettings = Schema.Struct({
  DOMAIN_EVENTS_QUEUE_URL: Schema.String,
  DOMAIN_EVENTS_DEAD_LETTER_QUEUE_ARN: Schema.String,
});

type LambdaSettings = typeof LambdaSettings.Type;

class LambdaMisconfigured extends Schema.TaggedError<
  LambdaMisconfigured,
  { readonly brand: "LambdaMisconfigured" }
>()("LambdaMisconfigured", { message: Schema.String }) {}

const application = applicationModules;

// Everything an invocation leaves running is registered here: Lambda freezes the
// process once the handler returns, so the handler waits for all of it first.
type Invocation = {
  readonly env: LambdaEnv;
  readonly settings: LambdaSettings;
  readonly credentials: AwsCredentials;
  readonly background: Array<Promise<unknown>>;
};

const isVariable = Schema.is(Schema.String);

const variablesOf = (env: LambdaEnv): Record<string, string> =>
  Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => isVariable(entry[1])),
  );

const settle = (background: Array<Promise<unknown>>): Effect.Effect<void> =>
  Effect.gen(function* () {
    let settled = 0;

    while (settled < background.length) {
      const pending = background.slice(settled);
      settled = background.length;
      yield* Effect.forEach(pending, (promise) => Effect.ignore(Effect.tryPromise(() => promise)), {
        discard: true,
      });
    }
  });

const runtimeLive = ({ background, env }: Invocation) =>
  Layer.mergeAll(
    ConfigProvider.layer(ConfigProvider.fromEnvRecord(variablesOf(env))),
    Layer.succeed(
      ExecutionContext,
      makeWorkerExecutionContext((promise) => background.push(promise)),
    ),
  );

const platformLive = (invocation: Invocation) =>
  Layer.mergeAll(DatabaseLive, TracerLive).pipe(
    Layer.provideMerge(EnvVars.layer),
    Layer.provideMerge(runtimeLive(invocation)),
  );

const domainEventQueue = ({ credentials, settings }: Invocation) =>
  SqsDomainEventQueueLive({
    sendMessageBatch: (entries) =>
      sendMessageBatch(credentials, settings.DOMAIN_EVENTS_QUEUE_URL, entries).pipe(
        Effect.provide(FetchHttpClient.layer),
        Effect.mapError((error) => new Cause.UnknownError(error, error.message)),
      ),
  });

const applicationLive = (invocation: Invocation) =>
  application.events.pipe(
    Layer.provideMerge(Layer.mergeAll(CommandBusLive, QueryBusLive, UnhandledFailuresLive)),
    Layer.provideMerge(application.layer),
    Layer.provideMerge(
      Layer.mergeAll(DomainEventBusLive, makeUnitOfWorkLive(domainEventQueue(invocation))),
    ),
    Layer.provideMerge(Layer.mergeAll(CookieCodec.layer, BillingGatewayLive, NodeCrypto.layer)),
    Layer.provideMerge(platformLive(invocation)),
  );

const httpLive = (invocation: Invocation) =>
  HttpApiBuilder.layer(Api).pipe(
    Layer.provide(application.http),
    Layer.provide(UserAuthMiddlewareLive),
    Layer.provideMerge(application.httpDeps),
    Layer.provideMerge(applicationLive(invocation)),
    Layer.provide(HttpServer.layerServices),
  );

const consumerLive = (invocation: Invocation) =>
  DeliveryLedgerLive.pipe(Layer.provideMerge(applicationLive(invocation)));

const sweeperLive = (invocation: Invocation) =>
  makeAfterCommitTransportLive(domainEventQueue(invocation)).pipe(
    Layer.provideMerge(platformLive(invocation)),
  );

// Run without an ambient memo map, so every invocation builds its layers afresh.
const runInvocation = <A, E, ROut>(
  { background }: Invocation,
  layer: Layer.Layer<ROut, E>,
  program: Effect.Effect<A, E, ROut>,
): Effect.Effect<A, E> => program.pipe(Effect.provide(layer), Effect.tap(settle(background)));

const fetchInvocation = (
  invocation: Invocation,
  event: FunctionUrlEvent,
): Effect.Effect<FunctionUrlResult> =>
  Effect.acquireUseRelease(
    Effect.sync(() =>
      HttpRouter.toWebHandler(httpLive(invocation), { memoMap: Layer.makeMemoMapUnsafe() }),
    ),
    ({ handler }) =>
      Effect.promise(() => handler(toRequest(event))).pipe(
        Effect.flatMap(toFunctionUrlResult),
        Effect.tap(settle(invocation.background)),
      ),
    ({ dispose }) => Effect.promise(() => dispose()),
  );

// A retried message is held back for its backoff before SQS redelivers it.
const holdBack = (invocation: Invocation, retries: ReadonlyArray<SqsRetry>) =>
  Effect.forEach(
    retries,
    (retry) =>
      changeMessageVisibility(invocation.credentials, invocation.settings.DOMAIN_EVENTS_QUEUE_URL, {
        receiptHandle: retry.receiptHandle,
        visibilityTimeoutSeconds: retry.delaySeconds,
      }).pipe(Effect.provide(FetchHttpClient.layer), Effect.ignore),
    { discard: true },
  );

const queueInvocation = Effect.fn("queueInvocation")(function* (
  invocation: Invocation,
  event: SqsEvent,
) {
  const retries: Array<SqsRetry> = [];
  const messages = toQueueMessages(event.Records, retries);

  const fromDeadLetters = event.Records.every(
    (record) => record.eventSourceARN === invocation.settings.DOMAIN_EVENTS_DEAD_LETTER_QUEUE_ARN,
  );

  if (fromDeadLetters) {
    yield* runInvocation(invocation, consumerLive(invocation), reportDeadLetters(messages));
  } else {
    yield* runInvocation(invocation, consumerLive(invocation), consumeDomainEvents(messages));
    yield* holdBack(invocation, retries);
  }

  return batchItemFailures(retries);
});

const scheduledInvocation = (invocation: Invocation, event: ScheduledJobEvent) => {
  switch (event.job) {
    case OUTBOX_SWEEP_JOB:
      return Effect.asVoid(runInvocation(invocation, sweeperLive(invocation), sweepOutbox()));
    case SESSION_PURGE_JOB:
      return Effect.asVoid(
        runInvocation(invocation, platformLive(invocation), purgeExpiredSessions),
      );
  }
};

type Invoked = FunctionUrlResult | ReturnType<typeof batchItemFailures> | void;

const isFunctionUrlEvent = Schema.is(FunctionUrlEvent);
const isSqsEvent = Schema.is(SqsEvent);

const misconfigured = (message: string) => Effect.die(new LambdaMisconfigured({ message }));

const invocationFor = (env: LambdaEnv): Effect.Effect<Invocation> =>
  Option.match(
    Option.all({
      settings: Schema.decodeUnknownOption(LambdaSettings)(env),
      credentials: awsCredentialsFrom(env),
    }),
    {
      onNone: () =>
        misconfigured(
          "The server Lambda needs its queue settings and its execution role's credentials",
        ),
      onSome: ({ credentials, settings }) =>
        Effect.succeed({ env, settings, credentials, background: [] }),
    },
  );

// A failed invocation dies, so Lambda records it and the event source retries it.
const invoke = (event: LambdaEvent): Effect.Effect<Invoked> =>
  Effect.flatMap(invocationFor(process.env), (invocation): Effect.Effect<Invoked> => {
    if (isFunctionUrlEvent(event)) return fetchInvocation(invocation, event);

    if (isSqsEvent(event)) return Effect.orDie(queueInvocation(invocation, event));

    return Effect.orDie(scheduledInvocation(invocation, event));
  });

const decodeEvent = Schema.decodeEffect(LambdaEvent);

// One function serves the Function URL, the domain-events queues and the schedule
// rules; the event's shape says which.
export const handler = (event: LambdaEvent): Promise<Invoked> =>
  Effect.runPromise(
    decodeEvent(event).pipe(
      Effect.catch(() => misconfigured("The server Lambda received an event it does not serve")),
      Effect.flatMap(invoke),
    ),
  );
