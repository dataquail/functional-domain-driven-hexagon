import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import {
  Event,
  EventBus,
  makeEventBus,
  makeUnhandledFailures,
  UnhandledFailures,
} from "@effect-server-utils/cqrs";
import {
  InMemoryDeliveryLedger,
  PassThroughUnitOfWork,
} from "@effect-server-utils/unit-of-work/testing";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

import {
  consumeDomainEvents,
  type QueueMessage,
  reportDeadLetters,
  retryDelaySeconds,
} from "@/globals/infrastructure/events/domain-event-consumer";

const InvitationSent = Event.make("InvitationSent", { email: Schema.String });

type Outcome = { acked: boolean; retriedAfter: Option.Option<number> };

const recordingMessage = (body: QueueMessage["body"], attempts = 1) => {
  const outcome: Outcome = { acked: false, retriedAfter: Option.none() };

  const message: QueueMessage = {
    id: `message-${attempts}`,
    body,
    attempts,
    ack: () => {
      outcome.acked = true;
    },
    retry: (options) => {
      outcome.retriedAfter = Option.some(options?.delaySeconds ?? 0);
    },
  };

  return { message, outcome };
};

const ConsumerLive = Layer.mergeAll(PassThroughUnitOfWork, InMemoryDeliveryLedger).pipe(
  Layer.provideMerge(makeEventBus()),
);

const envelopeFor = (handlerResult: Effect.Effect<void>) =>
  Effect.gen(function* () {
    const bus = yield* EventBus;
    const runs = yield* Ref.make(0);
    yield* bus.subscribeAfterCommit(
      InvitationSent,
      () =>
        Effect.andThen(
          Ref.update(runs, (n) => n + 1),
          handlerResult,
        ),
      { name: "send-invitation-email" },
    );
    const [envelope] = yield* bus.envelop([InvitationSent.make({ email: "a@example.com" })]);

    return { envelope, runs };
  });

describe("consumeDomainEvents", () => {
  it.effect("acks a message whose reaction succeeds", () =>
    Effect.gen(function* () {
      const { envelope, runs } = yield* envelopeFor(Effect.void);
      const { message, outcome } = recordingMessage(envelope);

      yield* consumeDomainEvents([message]);

      deepStrictEqual(outcome, { acked: true, retriedAfter: Option.none() });
      deepStrictEqual(yield* Ref.get(runs), 1);
    }).pipe(Effect.provide(ConsumerLive)),
  );

  it.effect("runs a redelivered envelope once", () =>
    Effect.gen(function* () {
      const { envelope, runs } = yield* envelopeFor(Effect.void);
      const first = recordingMessage(envelope, 1);
      const second = recordingMessage(envelope, 2);

      yield* consumeDomainEvents([first.message, second.message]);

      deepStrictEqual([first.outcome.acked, second.outcome.acked], [true, true]);
      deepStrictEqual(yield* Ref.get(runs), 1);
    }).pipe(Effect.provide(ConsumerLive)),
  );

  it.effect("retries a failed reaction with a delay that grows with each attempt", () =>
    Effect.gen(function* () {
      const { envelope } = yield* envelopeFor(Effect.die(new Error("mail provider down")));
      const { message, outcome } = recordingMessage(envelope, 3);

      yield* consumeDomainEvents([message]);

      deepStrictEqual(outcome, { acked: false, retriedAfter: Option.some(retryDelaySeconds(3)) });
    }).pipe(Effect.provide(ConsumerLive)),
  );

  it.effect("acks an envelope no subscription answers, since retrying cannot help", () =>
    Effect.gen(function* () {
      const { envelope } = yield* envelopeFor(Effect.void);
      const { message, outcome } = recordingMessage({ ...envelope, handler: "nobody" });

      yield* consumeDomainEvents([message]);

      deepStrictEqual(outcome, { acked: true, retriedAfter: Option.none() });
    }).pipe(Effect.provide(ConsumerLive)),
  );

  it.effect("drops a message that is not an envelope", () =>
    Effect.gen(function* () {
      const { message, outcome } = recordingMessage({ not: "an envelope" });

      yield* consumeDomainEvents([message]);

      deepStrictEqual(outcome, { acked: true, retriedAfter: Option.none() });
    }).pipe(Effect.provide(ConsumerLive)),
  );
});

describe("retryDelaySeconds", () => {
  it("doubles with each attempt and caps at fifteen minutes", () => {
    deepStrictEqual([1, 2, 3, 10, 20].map(retryDelaySeconds), [2, 4, 8, 900, 900]);
  });
});

describe("reportDeadLetters", () => {
  it.effect("reports each dead letter as an unhandled after-commit failure and acks it", () =>
    Effect.gen(function* () {
      const failures = yield* UnhandledFailures;

      const reported = yield* Stream.runCollect(Stream.take(yield* failures.stream, 1)).pipe(
        Effect.forkChild,
      );

      yield* Effect.yieldNow;
      const { envelope } = yield* envelopeFor(Effect.void);
      const { message, outcome } = recordingMessage(envelope, 11);

      yield* reportDeadLetters([message]);

      const [failure] = yield* Fiber.join(reported);
      deepStrictEqual(
        { source: failure?.source, kind: failure?.kind, eventTag: failure?.eventTag },
        {
          source: "send-invitation-email",
          kind: "after-commit-handler",
          eventTag: "InvitationSent",
        },
      );
      deepStrictEqual(outcome.acked, true);
    }).pipe(Effect.scoped, Effect.provide(Layer.merge(ConsumerLive, makeUnhandledFailures()))),
  );
});
