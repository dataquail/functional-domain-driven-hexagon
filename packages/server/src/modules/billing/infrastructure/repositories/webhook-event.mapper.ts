import { type RowSchemas } from "@org/database/index";

import { type WebhookEventRecord } from "@/modules/billing/domain/webhook-event/webhook-event.repository.js";
import { type ColumnMap } from "@/platform/persistence/criteria-to-sql.js";

type Row = RowSchemas.WebhookEventRow;

// Resolves the specification field names the live repository filters on to
// physical columns of billing.webhook_events. Only filterable scalar fields
// need an entry; `satisfies` keeps the keys honest against the record.
export const columns = {
  stripeEventId: "stripe_event_id",
} as const satisfies Partial<Record<keyof WebhookEventRecord, string>> & ColumnMap;

export const toDomain = (row: Row): WebhookEventRecord => ({
  stripeEventId: row.stripe_event_id,
  receivedAt: row.received_at,
});
