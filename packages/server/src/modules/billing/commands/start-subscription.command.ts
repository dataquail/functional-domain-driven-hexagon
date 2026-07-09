import * as Schema from "effect/Schema";

import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

export const StartSubscriptionCommand = Schema.TaggedStruct("StartSubscriptionCommand", {
  organizationId: OrganizationId,
});
export type StartSubscriptionCommand = typeof StartSubscriptionCommand.Type;

export const startSubscriptionCommandSpanAttributes: SpanAttributesExtractor<
  StartSubscriptionCommand
> = (cmd) => ({
  "organization.id": cmd.organizationId,
});
