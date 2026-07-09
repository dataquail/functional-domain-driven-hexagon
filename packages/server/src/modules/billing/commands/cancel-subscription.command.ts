import * as Schema from "effect/Schema";

import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

export const CancelSubscriptionCommand = Schema.TaggedStruct("CancelSubscriptionCommand", {
  organizationId: OrganizationId,
});
export type CancelSubscriptionCommand = typeof CancelSubscriptionCommand.Type;

export const cancelSubscriptionCommandSpanAttributes: SpanAttributesExtractor<
  CancelSubscriptionCommand
> = (cmd) => ({
  "organization.id": cmd.organizationId,
});
