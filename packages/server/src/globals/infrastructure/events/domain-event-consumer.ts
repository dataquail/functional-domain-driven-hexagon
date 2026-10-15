import {
  Event,
  type EventBus,
  UndeliverableEnvelope,
  UnhandledFailures,
} from "@effect-server-utils/cqrs";
import {
  deliverOnce,
  type DeliveryLedger,
  type UnitOfWork,
} from "@effect-server-utils/unit-of-work";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

export class DeadLetteredDomainEvent extends Schema.TaggedError<
  DeadLetteredDomainEvent,
  { readonly brand: "DeadLetteredDomainEvent" }
>()("DeadLetteredDomainEvent", { messageId: Schema.String, handler: Schema.String }) {}

export type QueueMessage = {
  readonly id: string;
  readonly body: unknown;
  readonly attempts: number;
  readonly ack: () => void;
  readonly retry: (options?: { readonly delaySeconds?: number }) => void;
};

const MAX_RETRY_DELAY_SECONDS = 900;

export const retryDelaySeconds = (attempts: number): number =>
  Math.min(2 ** Math.max(attempts, 1), MAX_RETRY_DELAY_SECONDS);

const decodeEnvelope = Schema.decodeUnknownOption(Event.Envelope);

const isUndeliverable = (cause: Cause.Cause<unknown>): boolean =>
  Option.match(Cause.findErrorOption(cause), {
    onNone: () => false,
    onSome: (error) => Schema.is(UndeliverableEnvelope)(error),
  });

// Retrying cannot help an envelope no subscription answers, so it is acked; the
// bus has already reported it.
const consumeOne = Effect.fn("DomainEventConsumer.consume")(function* (message: QueueMessage) {
  const envelope = decodeEnvelope(message.body);

  if (Option.isNone(envelope)) {
    yield* Effect.logError(`[domain-events] message ${message.id} is not an envelope; dropped`);
    message.ack();

    return;
  }

  const exit = yield* deliverOnce(envelope.value);

  if (Exit.isSuccess(exit) || isUndeliverable(exit.cause)) {
    message.ack();

    return;
  }

  message.retry({ delaySeconds: retryDelaySeconds(message.attempts) });
});

export const consumeDomainEvents = (
  messages: ReadonlyArray<QueueMessage>,
): Effect.Effect<void, never, EventBus | UnitOfWork | DeliveryLedger> =>
  Effect.forEach(messages, consumeOne, { discard: true });

export const reportDeadLetters = (
  messages: ReadonlyArray<QueueMessage>,
): Effect.Effect<void, never, UnhandledFailures> =>
  Effect.forEach(
    messages,
    Effect.fn("DomainEventConsumer.deadLetter")(function* (message) {
      const failures = yield* UnhandledFailures;
      const envelope = decodeEnvelope(message.body);

      const handler = Option.match(envelope, {
        onNone: () => "unknown",
        onSome: (value) => value.handler,
      });

      yield* Effect.logError("[domain-events] dead-lettered", {
        messageId: message.id,
        handler,
      });
      yield* failures.report({
        source: handler,
        kind: "after-commit-handler",
        eventTag: Option.getOrUndefined(Option.map(envelope, (value) => value.tag)),
        cause: Cause.fail(new DeadLetteredDomainEvent({ messageId: message.id, handler })),
      });
      message.ack();
    }),
    { discard: true },
  );
