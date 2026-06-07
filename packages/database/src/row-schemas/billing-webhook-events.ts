import type { StandardSchemaV1 } from "@standard-schema/spec";
import * as Schema from "effect/Schema";

export const WebhookEventRow = Schema.Struct({
  stripe_event_id: Schema.String,
  received_at: Schema.DateTimeUtcFromDate,
});
export type WebhookEventRow = typeof WebhookEventRow.Type;

export const WebhookEventRowStd: StandardSchemaV1<unknown, WebhookEventRow> =
  Schema.standardSchemaV1(WebhookEventRow);
