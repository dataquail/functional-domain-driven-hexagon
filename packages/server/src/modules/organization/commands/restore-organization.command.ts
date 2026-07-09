import * as Schema from "effect/Schema";

import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

export const RestoreOrganizationCommand = Schema.TaggedStruct("RestoreOrganizationCommand", {
  organizationId: OrganizationId,
});
export type RestoreOrganizationCommand = typeof RestoreOrganizationCommand.Type;

export const restoreOrganizationCommandSpanAttributes: SpanAttributesExtractor<
  RestoreOrganizationCommand
> = (cmd) => ({ "organization.id": cmd.organizationId });
