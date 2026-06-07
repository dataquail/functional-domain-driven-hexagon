import * as Schema from "effect/Schema";

export const SubscriptionId = Schema.String.pipe(Schema.brand("SubscriptionId"));
export type SubscriptionId = typeof SubscriptionId.Type;
