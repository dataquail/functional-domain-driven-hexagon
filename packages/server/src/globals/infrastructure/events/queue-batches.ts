import { Event } from "@effect-server-utils/cqrs";
import * as Schema from "effect/Schema";

export type QueueLimits = {
  readonly messagesPerBatch: number;
  readonly bytesPerBatch: number;
  readonly bytesPerMessage: number;
  readonly metadataBytesPerMessage: number;
};

export type QueueBatches = {
  readonly batches: ReadonlyArray<ReadonlyArray<Event.Envelope>>;
  readonly oversized: ReadonlyArray<Event.Envelope>;
};

const encoder = new TextEncoder();

export const encodeEnvelope = Schema.encodeSync(Schema.fromJsonString(Event.Envelope));

// Packs envelopes in order into the fewest batches the queue accepts, setting
// aside any envelope too large to be a message at all.
export const toBatchesWithin = (
  limits: QueueLimits,
  envelopes: ReadonlyArray<Event.Envelope>,
): QueueBatches => {
  const sizeOf = (envelope: Event.Envelope): number =>
    encoder.encode(encodeEnvelope(envelope)).byteLength + limits.metadataBytesPerMessage;

  const batches: Array<Array<Event.Envelope>> = [];
  const oversized: Array<Event.Envelope> = [];
  let current: Array<Event.Envelope> = [];
  let currentBytes = 0;

  for (const envelope of envelopes) {
    const bytes = sizeOf(envelope);

    if (bytes > limits.bytesPerMessage) {
      oversized.push(envelope);
      continue;
    }

    const full =
      current.length === limits.messagesPerBatch || currentBytes + bytes > limits.bytesPerBatch;

    if (full) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }

    current.push(envelope);
    currentBytes += bytes;
  }

  if (current.length > 0) batches.push(current);

  return { batches, oversized };
};
