import * as Schema from "effect/Schema";

import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { UserId } from "@/platform/ids/user-id.js";

export const CreateOrganizationCommand = Schema.TaggedStruct("CreateOrganizationCommand", {
  name: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(255)),
  // The creator — recorded as the first Membership of the org and the
  // future Phase 4 default-bundle grant target. Carried explicitly so
  // the bus boundary stays uniform; the HTTP endpoint is the one place
  // that translates `CurrentUser` into command input.
  actorUserId: UserId,
});
export type CreateOrganizationCommand = typeof CreateOrganizationCommand.Type;

export const createOrganizationCommandSpanAttributes: SpanAttributesExtractor<
  CreateOrganizationCommand
> = (cmd) => ({ "organization.name": cmd.name, "actor.user.id": cmd.actorUserId });
