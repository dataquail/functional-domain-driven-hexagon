import { type Event } from "@effect-server-utils/cqrs";
import type * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { DomainEventQueue } from "@/globals/infrastructure/events/domain-event-queue";
import {
  type QueueBatches,
  type QueueLimits,
  toBatchesWithin,
} from "@/globals/infrastructure/events/queue-batches";

export type QueueProducerBinding = {
  readonly sendBatch: (
    messages: ReadonlyArray<{ readonly body: Event.Envelope; readonly contentType: "json" }>,
  ) => Effect.Effect<void, Cause.UnknownError>;
};

// Cloudflare Queues limits: 100 messages and 256 KB per sendBatch, 128 KB per
// message. Each message also carries about 100 bytes of metadata.
export const QUEUE_LIMITS: QueueLimits = {
  messagesPerBatch: 100,
  bytesPerBatch: 256_000,
  bytesPerMessage: 128_000,
  metadataBytesPerMessage: 100,
};

export const toQueueBatches = (envelopes: ReadonlyArray<Event.Envelope>): QueueBatches =>
  toBatchesWithin(QUEUE_LIMITS, envelopes);

// `sendBatch` resolving means the messages are durably queued, so it is awaited
// before the response rather than left to `waitUntil`.
export const CloudflareDomainEventQueueLive = (binding: QueueProducerBinding) =>
  Layer.succeed(
    DomainEventQueue,
    DomainEventQueue.of({
      send: Effect.fn("CloudflareDomainEventQueue.send")(function* (envelopes) {
        const { batches, oversized } = toQueueBatches(envelopes);

        if (oversized.length > 0) {
          yield* Effect.logError(
            `[domain-events] ${oversized.length} envelope(s) exceed the queue's message size and stay in the outbox`,
          );
        }

        const unsent = yield* Effect.forEach(batches, (batch) =>
          binding
            .sendBatch(batch.map((envelope) => ({ body: envelope, contentType: "json" })))
            .pipe(
              Effect.as([]),
              Effect.catchCause((cause) =>
                Effect.as(Effect.logError("[domain-events] sendBatch failed", cause), batch),
              ),
            ),
        );

        return [...oversized, ...unsent.flat()];
      }),
    }),
  );
