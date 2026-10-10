import * as Schema from "effect/Schema";

export const PlatformRoleRow = Schema.Struct({
  user_id: Schema.String.check(Schema.isGUID()),
  role: Schema.String,
  granted_at: Schema.DateTimeUtcFromDate,
});
export type PlatformRoleRow = typeof PlatformRoleRow.Type;

export const EventOutboxRow = Schema.Struct({
  event_id: Schema.String.check(Schema.isGUID()),
  handler: Schema.String,
  tag: Schema.String,
  payload: Schema.Json,
  occurred_at: Schema.DateTimeUtcFromDate,
  relayed_at: Schema.NullOr(Schema.DateTimeUtcFromDate),
  attempts: Schema.Int,
  last_attempted_at: Schema.NullOr(Schema.DateTimeUtcFromDate),
});
export type EventOutboxRow = typeof EventOutboxRow.Type;
