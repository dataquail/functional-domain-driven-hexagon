import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { type AwsCredentials, awsPost, encodeJson } from "./aws-api";

export type SqsBatchEntry = { readonly Id: string; readonly MessageBody: string };

const SendMessageBatchResult = Schema.Struct({
  Failed: Schema.optional(Schema.Array(Schema.Struct({ Id: Schema.String }))),
});

const decodeBatchResult = Schema.decodeUnknownEffect(SendMessageBatchResult);

const NO_ANSWER = {};

const sqsCall = (credentials: AwsCredentials, action: string, payload: Schema.Json) =>
  awsPost(credentials, {
    service: "sqs",
    url: `https://sqs.${credentials.region}.amazonaws.com/`,
    headers: {
      "content-type": "application/x-amz-json-1.0",
      "x-amz-target": `AmazonSQS.${action}`,
    },
    body: encodeJson(payload),
  });

// Answers with the ids SQS refused; a refused entry is the caller's to keep.
export const sendMessageBatch = Effect.fn("Sqs.sendMessageBatch")(function* (
  credentials: AwsCredentials,
  queueUrl: string,
  entries: ReadonlyArray<SqsBatchEntry>,
) {
  const result = yield* sqsCall(credentials, "SendMessageBatch", {
    QueueUrl: queueUrl,
    Entries: entries.map((entry) => ({ Id: entry.Id, MessageBody: entry.MessageBody })),
  });

  const { Failed } = yield* decodeBatchResult(Option.getOrElse(result, () => NO_ANSWER)).pipe(
    Effect.orDie,
  );

  return (Failed ?? []).map((failure) => failure.Id);
});

export const changeMessageVisibility = Effect.fn("Sqs.changeMessageVisibility")(function* (
  credentials: AwsCredentials,
  queueUrl: string,
  message: { readonly receiptHandle: string; readonly visibilityTimeoutSeconds: number },
) {
  yield* sqsCall(credentials, "ChangeMessageVisibility", {
    QueueUrl: queueUrl,
    ReceiptHandle: message.receiptHandle,
    VisibilityTimeout: message.visibilityTimeoutSeconds,
  });
});
