import * as Schema from "effect/Schema";

import { OrganizationRoleValueObject } from "@/modules/organization/domain/organization-role.value-object.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

export const RevokeOrganizationRoleCommand = Schema.TaggedStruct("RevokeOrganizationRoleCommand", {
  userId: UserId,
  organizationId: OrganizationId,
  role: OrganizationRoleValueObject,
});
export type RevokeOrganizationRoleCommand = typeof RevokeOrganizationRoleCommand.Type;

export const revokeOrganizationRoleCommandSpanAttributes: SpanAttributesExtractor<
  RevokeOrganizationRoleCommand
> = (cmd) => ({
  "user.id": cmd.userId,
  "organization.id": cmd.organizationId,
  "organization.role": cmd.role,
});
