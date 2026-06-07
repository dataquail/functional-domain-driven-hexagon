import { type RowSchemas } from "@org/database/index";

import { type WebhookEventRecord } from "@/modules/billing/domain/ports/repositories/webhook-event-repository.js";

type Row = RowSchemas.WebhookEventRow;

export const toDomain = (row: Row): WebhookEventRecord => ({
  stripeEventId: row.stripe_event_id,
  receivedAt: row.received_at,
});
