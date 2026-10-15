import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import {
  batchItemFailures,
  FunctionUrlEvent,
  ScheduledJobEvent,
  SqsEvent,
  type SqsRecord,
  type SqsRetry,
  toFunctionUrlResult,
  toQueueMessages,
  toRequest,
} from "@/platform/lambda/lambda-events";

const functionUrlEvent = (overrides: Partial<FunctionUrlEvent> = {}): FunctionUrlEvent => ({
  rawPath: "/users",
  rawQueryString: "page=2",
  headers: { "content-type": "application/json" },
  requestContext: { domainName: "abc.lambda-url.us-east-2.on.aws", http: { method: "GET" } },
  isBase64Encoded: false,
  ...overrides,
});

const record = (overrides: Partial<SqsRecord> = {}): SqsRecord => ({
  messageId: "m-1",
  receiptHandle: "r-1",
  body: '{"eventId":"e-1"}',
  attributes: { ApproximateReceiveCount: "3" },
  eventSourceARN: "arn:aws:sqs:us-east-2:123456789012:domain-events",
  ...overrides,
});

describe("toRequest", () => {
  it("rebuilds the URL, method and headers the Function URL received", () => {
    const request = toRequest(functionUrlEvent());

    deepStrictEqual(request.url, "https://abc.lambda-url.us-east-2.on.aws/users?page=2");
    deepStrictEqual(request.method, "GET");
    deepStrictEqual(request.headers.get("content-type"), "application/json");
  });

  it("restores the cookies Function URLs carry apart from the headers", () => {
    const request = toRequest(functionUrlEvent({ cookies: ["session=abc", "theme=dark"] }));

    deepStrictEqual(request.headers.get("cookie"), "session=abc; theme=dark");
  });

  it.effect("decodes a base64 body byte for byte", () =>
    Effect.gen(function* () {
      const request = toRequest(
        functionUrlEvent({
          requestContext: { domainName: "abc.example", http: { method: "POST" } },
          body: Buffer.from('{"signed":true}').toString("base64"),
          isBase64Encoded: true,
        }),
      );

      deepStrictEqual(yield* Effect.promise(() => request.text()), '{"signed":true}');
    }),
  );
});

describe("toFunctionUrlResult", () => {
  it.effect("carries Set-Cookie apart from the headers and the body as base64", () =>
    Effect.gen(function* () {
      const headers = new Headers({ "content-type": "text/plain" });
      headers.append("set-cookie", "a=1");
      headers.append("set-cookie", "b=2");

      const result = yield* toFunctionUrlResult(new Response("hello", { status: 201, headers }));

      deepStrictEqual(result, {
        statusCode: 201,
        headers: { "content-type": "text/plain" },
        cookies: ["a=1", "b=2"],
        body: Buffer.from("hello").toString("base64"),
        isBase64Encoded: true,
      });
    }),
  );
});

describe("toQueueMessages", () => {
  it("hands the consumer the parsed body and the receive count", () => {
    const [message] = toQueueMessages([record()], []);

    deepStrictEqual(message?.body, { eventId: "e-1" });
    deepStrictEqual(message.attempts, 3);
  });

  it("passes a body that is not JSON through for the consumer to drop", () => {
    const [message] = toQueueMessages([record({ body: "not json" })], []);

    deepStrictEqual(message?.body, "not json");
  });

  it("reports only the retried messages as batch item failures", () => {
    const retries: Array<SqsRetry> = [];

    const [first, second] = toQueueMessages(
      [record(), record({ messageId: "m-2", receiptHandle: "r-2" })],
      retries,
    );

    first?.ack();
    second?.retry({ delaySeconds: 8 });

    deepStrictEqual(retries, [{ messageId: "m-2", receiptHandle: "r-2", delaySeconds: 8 }]);
    deepStrictEqual(batchItemFailures(retries), {
      batchItemFailures: [{ itemIdentifier: "m-2" }],
    });
  });
});

describe("the event schemas", () => {
  it("tell the three payloads apart", () => {
    const sqs = { Records: [record()] };
    const scheduled = { job: "outbox-sweep" };
    const url = functionUrlEvent();

    const kinds = [url, sqs, scheduled].map((event) => [
      Schema.is(FunctionUrlEvent)(event),
      Schema.is(SqsEvent)(event),
      Schema.is(ScheduledJobEvent)(event),
    ]);

    deepStrictEqual(kinds, [
      [true, false, false],
      [false, true, false],
      [false, false, true],
    ]);
  });
});
