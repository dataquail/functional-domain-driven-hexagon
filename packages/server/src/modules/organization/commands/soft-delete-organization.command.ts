import * as Schema from "effect/Schema";

import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

export const SoftDeleteOrganizationCommand = Schema.TaggedStruct("SoftDeleteOrganizationCommand", {
  organizationId: OrganizationId,
});
export type SoftDeleteOrganizationCommand = typeof SoftDeleteOrganizationCommand.Type;

export const softDeleteOrganizationCommandSpanAttributes: SpanAttributesExtractor<
  SoftDeleteOrganizationCommand
> = (cmd) => ({ "organization.id": cmd.organizationId });
