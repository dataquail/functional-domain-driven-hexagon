import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { type QueueMessage } from "@/globals/infrastructure/events/domain-event-consumer";

// The slices of the three Lambda payloads this host reads: a Function URL
// request (payload format 2.0), an SQS batch, and the constant input of an
// EventBridge schedule rule.

export const FunctionUrlEvent = Schema.Struct({
  rawPath: Schema.String,
  rawQueryString: Schema.String,
  cookies: Schema.optional(Schema.Array(Schema.String)),
  headers: Schema.Record(Schema.String, Schema.String),
  requestContext: Schema.Struct({
    domainName: Schema.String,
    http: Schema.Struct({ method: Schema.String }),
  }),
  body: Schema.optional(Schema.String),
  isBase64Encoded: Schema.Boolean,
});

export type FunctionUrlEvent = typeof FunctionUrlEvent.Type;

const SqsRecord = Schema.Struct({
  messageId: Schema.String,
  receiptHandle: Schema.String,
  body: Schema.String,
  attributes: Schema.Struct({ ApproximateReceiveCount: Schema.String }),
  eventSourceARN: Schema.String,
});

export type SqsRecord = typeof SqsRecord.Type;

export const SqsEvent = Schema.Struct({ Records: Schema.Array(SqsRecord) });

export type SqsEvent = typeof SqsEvent.Type;

// The infra stack's schedule rules send exactly these inputs.
export const OUTBOX_SWEEP_JOB = "outbox-sweep";
export const SESSION_PURGE_JOB = "purge-expired-sessions";

export const ScheduledJobEvent = Schema.Struct({
  job: Schema.Literals([OUTBOX_SWEEP_JOB, SESSION_PURGE_JOB]),
});

export type ScheduledJobEvent = typeof ScheduledJobEvent.Type;

export const LambdaEvent = Schema.Union([FunctionUrlEvent, SqsEvent, ScheduledJobEvent]);

export type LambdaEvent = typeof LambdaEvent.Type;

export type FunctionUrlResult = {
  readonly statusCode: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly cookies: ReadonlyArray<string>;
  readonly body: string;
  readonly isBase64Encoded: true;
};

const carriesBody = (method: string) => method !== "GET" && method !== "HEAD";

const decodedBody =
  (event: FunctionUrlEvent) =>
  (body: string): BodyInit => {
    if (event.isBase64Encoded) return new Uint8Array(Buffer.from(body, "base64"));

    return body;
  };

const requestBody = (event: FunctionUrlEvent): Option.Option<BodyInit> =>
  Option.fromUndefinedOr(event.body).pipe(
    Option.filter(() => carriesBody(event.requestContext.http.method)),
    Option.map(decodedBody(event)),
  );

const requestHeaders = (event: FunctionUrlEvent): Headers => {
  const headers = new Headers(event.headers);

  const cookies = Option.fromUndefinedOr(event.cookies).pipe(
    Option.filter((all) => all.length > 0),
  );

  if (Option.isSome(cookies)) headers.set("cookie", cookies.value.join("; "));

  return headers;
};

const queryOf = (rawQueryString: string): string => {
  if (rawQueryString.length === 0) return "";

  return `?${rawQueryString}`;
};

export const toRequest = (event: FunctionUrlEvent): Request =>
  new Request(
    `https://${event.requestContext.domainName}${event.rawPath}${queryOf(event.rawQueryString)}`,
    {
      method: event.requestContext.http.method,
      headers: requestHeaders(event),
      ...Option.match(requestBody(event), {
        onNone: () => ({}),
        onSome: (body) => ({ body, duplex: "half" }),
      }),
    },
  );

const plainHeaders = (response: Response) =>
  Object.fromEntries([...response.headers].filter(([name]) => name !== "set-cookie"));

// Function URLs carry Set-Cookie apart from the other headers, one entry per cookie.
export const toFunctionUrlResult = (response: Response): Effect.Effect<FunctionUrlResult> =>
  Effect.map(
    Effect.promise(() => response.arrayBuffer()),
    (bytes) => ({
      statusCode: response.status,
      headers: plainHeaders(response),
      cookies: response.headers.getSetCookie(),
      body: Buffer.from(bytes).toString("base64"),
      isBase64Encoded: true,
    }),
  );

export type SqsRetry = {
  readonly messageId: string;
  readonly receiptHandle: string;
  readonly delaySeconds: number;
};

const decodeJson = Schema.decodeOption(Schema.fromJsonString(Schema.Json));

// A body that is not JSON goes to the consumer as it came, for it to drop.
const parseBody = (body: string): Schema.Json => Option.getOrElse(decodeJson(body), () => body);

// SQS has no per-message ack: a message the handler does not report as failed
// is deleted when the invocation succeeds, so `ack` records nothing.
export const toQueueMessages = (
  records: ReadonlyArray<SqsRecord>,
  retries: Array<SqsRetry>,
): ReadonlyArray<QueueMessage> =>
  records.map((record) => ({
    id: record.messageId,
    body: parseBody(record.body),
    attempts: Number(record.attributes.ApproximateReceiveCount),
    ack: () => {},
    retry: (options) => {
      retries.push({
        messageId: record.messageId,
        receiptHandle: record.receiptHandle,
        delaySeconds: Option.getOrElse(
          Option.fromUndefinedOr(options).pipe(
            Option.flatMap(({ delaySeconds }) => Option.fromUndefinedOr(delaySeconds)),
          ),
          () => 0,
        ),
      });
    },
  }));

export const batchItemFailures = (retries: ReadonlyArray<SqsRetry>) => ({
  batchItemFailures: retries.map((retry) => ({ itemIdentifier: retry.messageId })),
});
