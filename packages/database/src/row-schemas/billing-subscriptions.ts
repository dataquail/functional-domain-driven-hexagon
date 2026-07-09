import type { StandardSchemaV1 } from "@standard-schema/spec";
import * as Schema from "effect/Schema";

export const SubscriptionRow = Schema.Struct({
  id: Schema.String.check(Schema.isGUID()),
  organization_id: Schema.String.check(Schema.isGUID()),
  stripe_customer_id: Schema.String,
  stripe_subscription_id: Schema.String,
  status: Schema.String,
  current_period_end: Schema.NullOr(Schema.DateTimeUtcFromDate),
  created_at: Schema.DateTimeUtcFromDate,
  updated_at: Schema.DateTimeUtcFromDate,
});
export type SubscriptionRow = typeof SubscriptionRow.Type;

export const SubscriptionRowStd: StandardSchemaV1<unknown, SubscriptionRow> =
  Schema.toStandardSchemaV1(SubscriptionRow);
