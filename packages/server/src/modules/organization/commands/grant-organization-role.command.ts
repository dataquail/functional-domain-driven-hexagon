import * as Schema from "effect/Schema";

import { OrganizationRoleValueObject } from "@/modules/organization/domain/organization-roles/organization-role.value-object.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

export const GrantOrganizationRoleCommand = Schema.TaggedStruct("GrantOrganizationRoleCommand", {
  // The user receiving the role.
  userId: UserId,
  organizationId: OrganizationId,
  role: OrganizationRoleValueObject,
  // The user dispatching the command. Carried explicitly (rather than
  // pulled from `CurrentUser`) so the bus boundary stays uniform — the
  // HTTP endpoint is the one place that translates request-context
  // into command input. Persisted as `issued_by` for audit.
  actorUserId: UserId,
});
export type GrantOrganizationRoleCommand = typeof GrantOrganizationRoleCommand.Type;

export const grantOrganizationRoleCommandSpanAttributes: SpanAttributesExtractor<
  GrantOrganizationRoleCommand
> = (cmd) => ({
  "user.id": cmd.userId,
  "organization.id": cmd.organizationId,
  "organization.role": cmd.role,
  "actor.user.id": cmd.actorUserId,
});
