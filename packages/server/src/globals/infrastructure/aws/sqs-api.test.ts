import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { assertInstanceOf } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import type * as HttpBody from "effect/http/HttpBody";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";

import { type AwsCredentials, AwsRequestFailed } from "@/globals/infrastructure/aws/aws-api";
import { changeMessageVisibility, sendMessageBatch } from "@/globals/infrastructure/aws/sqs-api";

const credentials: AwsCredentials = {
  accessKeyId: "AKIDEXAMPLE",
  secretAccessKey: Redacted.make("secret"),
  sessionToken: Option.none(),
  region: "us-east-2",
};

const QUEUE_URL = "https://sqs.us-east-2.amazonaws.com/123456789012/domain-events";

type Sent = { url: string; target: string; body: Schema.Json };

const decodeJsonBody = Schema.decodeSync(Schema.fromJsonString(Schema.Json));

const bodyBytes = (body: HttpBody.HttpBody): Uint8Array => {
  if (Predicate.isTagged(body, "Uint8Array")) return body.body;

  return new Uint8Array();
};

const sqsAnswering = (status: number, answer: string, sent: Array<Sent>) =>
  HttpClient.make((request) => {
    sent.push({
      url: request.url,
      target: request.headers["x-amz-target"] ?? "",
      body: decodeJsonBody(new TextDecoder().decode(bodyBytes(request.body))),
    });

    return Effect.succeed(HttpClientResponse.fromWeb(request, new Response(answer, { status })));
  });

describe("sendMessageBatch", () => {
  it.effect("posts the entries to the queue over the SQS JSON protocol", () =>
    Effect.gen(function* () {
      const sent: Array<Sent> = [];

      const refused = yield* sendMessageBatch(credentials, QUEUE_URL, [
        { Id: "0", MessageBody: "{}" },
      ]).pipe(
        Effect.provideService(
          HttpClient.HttpClient,
          sqsAnswering(200, '{"Successful":[{"Id":"0"}]}', sent),
        ),
      );

      deepStrictEqual(refused, []);
      deepStrictEqual(sent, [
        {
          url: "https://sqs.us-east-2.amazonaws.com/",
          target: "AmazonSQS.SendMessageBatch",
          body: { QueueUrl: QUEUE_URL, Entries: [{ Id: "0", MessageBody: "{}" }] },
        },
      ]);
    }),
  );

  it.effect("answers with the ids SQS refused", () =>
    Effect.gen(function* () {
      const refused = yield* sendMessageBatch(credentials, QUEUE_URL, [
        { Id: "0", MessageBody: "{}" },
        { Id: "1", MessageBody: "{}" },
      ]).pipe(
        Effect.provideService(
          HttpClient.HttpClient,
          sqsAnswering(200, '{"Successful":[{"Id":"0"}],"Failed":[{"Id":"1"}]}', []),
        ),
      );

      deepStrictEqual(refused, ["1"]);
    }),
  );

  it.effect("fails with AwsRequestFailed when SQS answers with an error status", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        sendMessageBatch(credentials, QUEUE_URL, [{ Id: "0", MessageBody: "{}" }]).pipe(
          Effect.provideService(
            HttpClient.HttpClient,
            sqsAnswering(400, '{"__type":"AccessDenied"}', []),
          ),
        ),
      );

      assertInstanceOf(error, AwsRequestFailed);
    }),
  );
});

describe("changeMessageVisibility", () => {
  it.effect("asks SQS to hold the message back for the given seconds", () =>
    Effect.gen(function* () {
      const sent: Array<Sent> = [];

      yield* changeMessageVisibility(credentials, QUEUE_URL, {
        receiptHandle: "receipt",
        visibilityTimeoutSeconds: 8,
      }).pipe(Effect.provideService(HttpClient.HttpClient, sqsAnswering(200, "", sent)));

      deepStrictEqual(sent, [
        {
          url: "https://sqs.us-east-2.amazonaws.com/",
          target: "AmazonSQS.ChangeMessageVisibility",
          body: { QueueUrl: QUEUE_URL, ReceiptHandle: "receipt", VisibilityTimeout: 8 },
        },
      ]);
    }),
  );
});
