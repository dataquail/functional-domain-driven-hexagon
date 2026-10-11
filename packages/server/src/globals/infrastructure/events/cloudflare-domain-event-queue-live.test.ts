import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { type Event } from "@effect-server-utils/cqrs";
import * as Effect from "effect/Effect";

import {
  CloudflareDomainEventQueueLive,
  QUEUE_LIMITS,
  toQueueBatches,
} from "@/globals/infrastructure/events/cloudflare-domain-event-queue-live.js";
import { DomainEventQueue } from "@/globals/infrastructure/events/domain-event-queue.js";

const envelope = (index: number, payloadBytes = 10): Event.Envelope => ({
  eventId: `00000000-0000-0000-0000-${String(index).padStart(12, "0")}`,
  handler: "send-invitation-email",
  tag: "InvitationSent",
  occurredAt: "2026-10-11T00:00:00.000Z",
  payload: { padding: "x".repeat(payloadBytes) },
});

const envelopes = (count: number, payloadBytes?: number) =>
  Array.from({ length: count }, (_, index) => envelope(index, payloadBytes));

describe("toQueueBatches", () => {
  it("splits at the per-batch message count", () => {
    const { batches } = toQueueBatches(envelopes(250));

    deepStrictEqual(
      batches.map((batch) => batch.length),
      [100, 100, 50],
    );
  });

  it("splits before a batch would pass its byte limit", () => {
    const { batches } = toQueueBatches(envelopes(5, 60_000));

    deepStrictEqual(
      batches.map((batch) => batch.length),
      [4, 1],
    );
  });

  it("sets aside an envelope larger than one message may be", () => {
    const tooLarge = envelope(1, QUEUE_LIMITS.bytesPerMessage);
    const { batches, oversized } = toQueueBatches([envelope(0), tooLarge, envelope(2)]);

    deepStrictEqual(oversized, [tooLarge]);
    deepStrictEqual(batches, [[envelope(0), envelope(2)]]);
  });
});

const send =
  (sendBatch: (messages: Iterable<{ readonly body: unknown }>) => Promise<unknown>) =>
  (all: ReadonlyArray<Event.Envelope>) =>
    Effect.flatMap(Effect.service(DomainEventQueue), (queue) => queue.send(all)).pipe(
      Effect.provide(CloudflareDomainEventQueueLive({ sendBatch })),
    );

describe("CloudflareDomainEventQueueLive", () => {
  it.effect("sends every envelope as a JSON message and reports none undelivered", () =>
    Effect.gen(function* () {
      const sent: Array<unknown> = [];
      const undelivered = yield* send(async (messages) => {
        for (const message of messages) sent.push(message.body);
      })(envelopes(3));

      deepStrictEqual(undelivered, []);
      deepStrictEqual(sent, envelopes(3));
    }),
  );

  it.effect("reports the envelopes of a refused batch as undelivered", () =>
    Effect.gen(function* () {
      let calls = 0;
      const undelivered = yield* send(async () => {
        calls += 1;
        if (calls === 2) throw new Error("Too Many Requests");
      })(envelopes(150));

      deepStrictEqual(undelivered, envelopes(150).slice(100));
    }),
  );

  it.effect("reports an oversized envelope as undelivered without sending it", () =>
    Effect.gen(function* () {
      const tooLarge = envelope(1, QUEUE_LIMITS.bytesPerMessage);
      const undelivered = yield* send(async () => undefined)([tooLarge]);

      deepStrictEqual(undelivered, [tooLarge]);
    }),
  );
});
