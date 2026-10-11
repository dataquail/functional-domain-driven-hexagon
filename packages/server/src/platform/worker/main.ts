import type {
  ExecutionContext as WorkerExecutionContext,
  Fetcher,
  Hyperdrive,
  MessageBatch,
  Queue,
  ScheduledController,
  SendEmail,
} from "@cloudflare/workers-types";
import { purgeExpiredSessions } from "@org/jobs/jobs/purge-expired-sessions";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as Layer from "effect/Layer";

import { CookieCodec } from "@/globals/infrastructure/auth/cookie-codec.js";
import { EnvVars } from "@/globals/infrastructure/config/env-vars.js";
import {
  CommandBusLive,
  DomainEventBusLive,
  makeAfterCommitTransportLive,
  makeUnitOfWorkLive,
  QueryBusLive,
  UnhandledFailuresLive,
} from "@/globals/infrastructure/cqrs/cqrs-runtime.js";
import { DatabaseLive } from "@/globals/infrastructure/database/database-live.js";
import { CloudflareDomainEventQueueLive } from "@/globals/infrastructure/events/cloudflare-domain-event-queue-live.js";
import { DeliveryLedgerLive } from "@/globals/infrastructure/events/delivery-ledger-live.js";
import {
  consumeDomainEvents,
  type QueueMessage,
  reportDeadLetters,
} from "@/globals/infrastructure/events/domain-event-consumer.js";
import { sweepOutbox } from "@/globals/infrastructure/events/outbox-sweeper.js";
import { Api } from "@/globals/infrastructure/framework/http/api.js";
import { UserAuthMiddlewareLive } from "@/globals/infrastructure/framework/middlewares/auth-middleware-live.js";
import { applicationModules } from "@/globals/infrastructure/framework/modules/application-modules.js";
import { TracerLive } from "@/globals/infrastructure/observability/tracer-live.js";
import { EmailBinding } from "@/globals/infrastructure/runtime/email-binding.js";
import {
  ExecutionContext,
  makeWorkerExecutionContext,
} from "@/globals/infrastructure/runtime/execution-context.js";
import { IssuerTransport } from "@/globals/infrastructure/runtime/issuer-transport.js";
import { BillingGatewayLive } from "@/modules/billing/billing.platform.js";

type ServerWorkerEnv = {
  readonly APP_DB: Hyperdrive;
  readonly IDENTITY: Fetcher;
  readonly DOMAIN_EVENTS: Queue;
  readonly DOMAIN_EVENTS_DEAD_LETTER_QUEUE: string;
  readonly EMAIL?: SendEmail;
} & Readonly<Record<string, unknown>>;

const OUTBOX_SWEEP_CRON = "* * * * *";
const SESSION_PURGE_CRON = "0 * * * *";

const application = applicationModules;

const configFrom = (env: ServerWorkerEnv): Record<string, string> => ({
  ...Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  ),
  DATABASE_URL: env.APP_DB.connectionString,
});

// Everything a request leaves running is registered here, so the invocation's
// layers are disposed only once it has settled.
type Invocation = {
  readonly env: ServerWorkerEnv;
  readonly background: Array<Promise<unknown>>;
};

const settle = (background: Array<Promise<unknown>>): Effect.Effect<void> =>
  Effect.gen(function* () {
    let settled = 0;
    while (settled < background.length) {
      const pending = background.slice(settled);
      settled = background.length;
      yield* Effect.promise(() => Promise.allSettled(pending));
    }
  });

// workers-types and TypeScript's DOM lib describe the same Request and Response
// classes with incompatible declarations, so the binding is bridged once, here.
const throughServiceBinding =
  (binding: Fetcher) =>
  (url: string, init: RequestInit): Promise<Response> =>
    binding.fetch(url, init as never) as unknown as Promise<Response>;

const runtimeLive = ({ background, env }: Invocation) =>
  Layer.mergeAll(
    ConfigProvider.layer(ConfigProvider.fromEnvRecord(configFrom(env))),
    Layer.succeed(
      ExecutionContext,
      makeWorkerExecutionContext((promise) => background.push(promise)),
    ),
    Layer.succeed(IssuerTransport, { fetch: throughServiceBinding(env.IDENTITY) }),
    Layer.succeed(
      EmailBinding,
      env.EMAIL === undefined ? {} : { send: (message) => (env.EMAIL as SendEmail).send(message) },
    ),
  );

const platformLive = (invocation: Invocation) =>
  Layer.mergeAll(DatabaseLive, TracerLive).pipe(
    Layer.provideMerge(EnvVars.layer),
    Layer.provideMerge(runtimeLive(invocation)),
  );

const domainEventQueue = ({ env }: Invocation) => CloudflareDomainEventQueueLive(env.DOMAIN_EVENTS);

const applicationLive = (invocation: Invocation) =>
  application.events.pipe(
    Layer.provideMerge(Layer.mergeAll(CommandBusLive, QueryBusLive, UnhandledFailuresLive)),
    Layer.provideMerge(application.layer),
    Layer.provideMerge(
      Layer.mergeAll(DomainEventBusLive, makeUnitOfWorkLive(domainEventQueue(invocation))),
    ),
    Layer.provideMerge(Layer.mergeAll(CookieCodec.layer, BillingGatewayLive)),
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
): Promise<void> =>
  Effect.runPromise(
    program.pipe(Effect.provide(layer), Effect.andThen(settle(background)), Effect.asVoid),
  );

const toQueueMessages = (batch: MessageBatch): ReadonlyArray<QueueMessage> =>
  batch.messages.map((message) => ({
    id: message.id,
    body: message.body,
    attempts: message.attempts,
    ack: () => {
      message.ack();
    },
    retry: (options) => {
      message.retry(options);
    },
  }));

export default {
  fetch(request: Request, env: ServerWorkerEnv, ctx: WorkerExecutionContext): Promise<Response> {
    const invocation: Invocation = { env, background: [] };
    const { dispose, handler } = HttpRouter.toWebHandler(httpLive(invocation), {
      memoMap: Layer.makeMemoMapUnsafe(),
    });
    return handler(request).then((response) => {
      ctx.waitUntil(Effect.runPromise(settle(invocation.background)).then(dispose));
      return response;
    });
  },

  queue(batch: MessageBatch, env: ServerWorkerEnv): Promise<void> {
    const invocation: Invocation = { env, background: [] };
    const messages = toQueueMessages(batch);
    return runInvocation(
      invocation,
      consumerLive(invocation),
      batch.queue === env.DOMAIN_EVENTS_DEAD_LETTER_QUEUE
        ? reportDeadLetters(messages)
        : consumeDomainEvents(messages),
    );
  },

  scheduled(
    controller: ScheduledController,
    env: ServerWorkerEnv,
    ctx: WorkerExecutionContext,
  ): Promise<void> {
    const invocation: Invocation = { env, background: [] };
    const job =
      controller.cron === OUTBOX_SWEEP_CRON
        ? runInvocation(invocation, sweeperLive(invocation), sweepOutbox())
        : controller.cron === SESSION_PURGE_CRON
          ? runInvocation(invocation, platformLive(invocation), purgeExpiredSessions)
          : Promise.reject(new Error(`No job is scheduled on "${controller.cron}"`));
    ctx.waitUntil(job);
    return job;
  },
};
