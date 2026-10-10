import { Spec, type Specification } from "@/globals/application/ddd/specification.js";

import { type WebhookEventRecord } from "./webhook-event.repository.js";

// Translatable spec (carries a Criteria → usable as a repository filter and as
// an in-memory guard). The field-name string lives here and in the mapper's
// column map; `Spec.eq` types it against WebhookEventRecord so a typo is a
// compile error.
const withStripeEventId = (stripeEventId: string): Specification<WebhookEventRecord> =>
  Spec.eq<WebhookEventRecord, "stripeEventId">("stripeEventId", stripeEventId);

export const WebhookEventSpecifications = { withStripeEventId } as const;
