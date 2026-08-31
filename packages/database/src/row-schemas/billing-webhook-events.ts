import * as Schema from "effect/Schema";

export const WebhookEventRow = Schema.Struct({
  stripe_event_id: Schema.String,
  received_at: Schema.DateTimeUtcFromDate,
});
export type WebhookEventRow = typeof WebhookEventRow.Type;
