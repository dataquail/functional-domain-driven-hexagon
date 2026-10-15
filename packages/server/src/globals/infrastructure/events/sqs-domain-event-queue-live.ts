import { type Event } from "@effect-server-utils/cqrs";
import type * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { DomainEventQueue } from "@/globals/infrastructure/events/domain-event-queue";
import {
  encodeEnvelope,
  type QueueLimits,
  toBatchesWithin,
} from "@/globals/infrastructure/events/queue-batches";

export type SqsBatchEntry = { readonly Id: string; readonly MessageBody: string };

// Answers with the ids of the entries SQS refused.
export type SqsQueueProducer = {
  readonly sendMessageBatch: (
    entries: ReadonlyArray<SqsBatchEntry>,
  ) => Effect.Effect<ReadonlyArray<string>, Cause.UnknownError>;
};

// SQS limits: 10 entries per SendMessageBatch, 256 KiB per message and per batch.
export const SQS_LIMITS: QueueLimits = {
  messagesPerBatch: 10,
  bytesPerBatch: 262_144,
  bytesPerMessage: 262_144,
  metadataBytesPerMessage: 0,
};

const refusedEnvelopes = Effect.fn("SqsDomainEventQueue.sendBatch")(function* (
  producer: SqsQueueProducer,
  batch: ReadonlyArray<Event.Envelope>,
) {
  const refusedIds = yield* producer.sendMessageBatch(
    batch.map((envelope, index) => ({ Id: String(index), MessageBody: encodeEnvelope(envelope) })),
  );

  const refused = batch.filter((_, index) => refusedIds.includes(String(index)));

  if (refused.length > 0) {
    yield* Effect.logError(`[domain-events] SQS refused ${refused.length} message(s)`);
  }

  return refused;
});

const sendBatch = (producer: SqsQueueProducer, batch: ReadonlyArray<Event.Envelope>) =>
  refusedEnvelopes(producer, batch).pipe(
    Effect.catchCause((cause) =>
      Effect.as(Effect.logError("[domain-events] SendMessageBatch failed", cause), batch),
    ),
  );

// SendMessageBatch answering means the accepted messages are durably queued, so
// it is awaited before the response, as on Cloudflare.
export const SqsDomainEventQueueLive = (producer: SqsQueueProducer) =>
  Layer.succeed(
    DomainEventQueue,
    DomainEventQueue.of({
      send: Effect.fn("SqsDomainEventQueue.send")(function* (envelopes) {
        const { batches, oversized } = toBatchesWithin(SQS_LIMITS, envelopes);

        if (oversized.length > 0) {
          yield* Effect.logError(
            `[domain-events] ${oversized.length} envelope(s) exceed the queue's message size and stay in the outbox`,
          );
        }

        const unsent = yield* Effect.forEach(batches, (batch) => sendBatch(producer, batch));

        return [...oversized, ...unsent.flat()];
      }),
    }),
  );
