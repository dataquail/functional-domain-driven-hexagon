import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { type Event } from "@effect-server-utils/cqrs";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";

import { DomainEventQueue } from "@/globals/infrastructure/events/domain-event-queue";
import { encodeEnvelope } from "@/globals/infrastructure/events/queue-batches";
import {
  SQS_LIMITS,
  type SqsBatchEntry,
  SqsDomainEventQueueLive,
  type SqsQueueProducer,
} from "@/globals/infrastructure/events/sqs-domain-event-queue-live";

const envelope = (index: number, payloadBytes = 10): Event.Envelope => ({
  eventId: `00000000-0000-0000-0000-${String(index).padStart(12, "0")}`,
  handler: "send-invitation-email",
  tag: "InvitationSent",
  occurredAt: "2026-10-11T00:00:00.000Z",
  payload: { padding: "x".repeat(payloadBytes) },
});

const envelopes = (count: number) => Array.from({ length: count }, (_, index) => envelope(index));

const send =
  (sendMessageBatch: SqsQueueProducer["sendMessageBatch"]) =>
  (all: ReadonlyArray<Event.Envelope>) =>
    Effect.flatMap(Effect.service(DomainEventQueue), (queue) => queue.send(all)).pipe(
      Effect.provide(SqsDomainEventQueueLive({ sendMessageBatch })),
    );

describe("SqsDomainEventQueueLive", () => {
  it.effect("sends ten envelopes per batch, each as its JSON encoding", () =>
    Effect.gen(function* () {
      const batches: Array<ReadonlyArray<SqsBatchEntry>> = [];

      const undelivered = yield* send((entries) =>
        Effect.sync(() => {
          batches.push(entries);

          return [];
        }),
      )(envelopes(25));

      deepStrictEqual(undelivered, []);
      deepStrictEqual(
        batches.map((batch) => batch.length),
        [10, 10, 5],
      );
      deepStrictEqual(batches[0]?.[0], { Id: "0", MessageBody: encodeEnvelope(envelope(0)) });
    }),
  );

  it.effect("reports the entries SQS refused as undelivered", () =>
    Effect.gen(function* () {
      const undelivered = yield* send(() => Effect.succeed(["1", "3"]))(envelopes(4));

      deepStrictEqual(undelivered, [envelope(1), envelope(3)]);
    }),
  );

  it.effect("reports a whole batch as undelivered when the call fails", () =>
    Effect.gen(function* () {
      let calls = 0;

      const undelivered = yield* send(() =>
        Effect.suspend(() => {
          calls += 1;

          if (calls === 2) return Effect.fail(new Cause.UnknownError("Throttled"));

          return Effect.succeed([]);
        }),
      )(envelopes(15));

      deepStrictEqual(undelivered, envelopes(15).slice(10));
    }),
  );

  it.effect("keeps an envelope larger than one message may be without sending it", () =>
    Effect.gen(function* () {
      const tooLarge = envelope(1, SQS_LIMITS.bytesPerMessage);
      const undelivered = yield* send(() => Effect.succeed([]))([tooLarge]);

      deepStrictEqual(undelivered, [tooLarge]);
    }),
  );
});
