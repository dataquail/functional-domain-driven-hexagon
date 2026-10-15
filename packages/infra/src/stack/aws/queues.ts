import * as AWS from "alchemy/AWS";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";

import { DOMAIN_EVENTS_MAX_RECEIVES, queueVisibilityTimeoutSeconds } from "../../aws-stage";

export const SERVER_TIMEOUT_SECONDS = 30;

const RETENTION = Duration.days(14);

export const domainEventsDeadLetterQueue = AWS.SQS.Queue("domain-events-dlq", {
  messageRetentionPeriod: RETENTION,
});

export const domainEventsQueue = Effect.gen(function* () {
  const deadLetters = yield* domainEventsDeadLetterQueue;

  return yield* AWS.SQS.Queue("domain-events", {
    visibilityTimeout: Duration.seconds(queueVisibilityTimeoutSeconds(SERVER_TIMEOUT_SECONDS)),
    messageRetentionPeriod: RETENTION,
    redrivePolicy: {
      deadLetterTargetArn: deadLetters.queueArn,
      maxReceiveCount: DOMAIN_EVENTS_MAX_RECEIVES,
    },
  });
});
