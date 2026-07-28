import { Command } from "@org/cqrs";
import * as Schema from "effect/Schema";

import { MembershipNotFound } from "@/modules/organization/domain/membership/membership.errors.js";
import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

// Removes another user from an org. `actorUserId` is recorded for
// span attributes and (Phase 4) the policy layer's grant check; the
// handler itself doesn't enforce a "no self-removal" invariant —
// callers wanting to leave should dispatch `LeaveOrganizationCommand`,
// which is the authenticated-self path with its own policy.
export const RemoveMemberCommand = Command.make("RemoveMemberCommand", {
  payload: {
    targetUserId: UserId,
    organizationId: OrganizationId,
    actorUserId: UserId,
  },
  success: Schema.Void,
  failure: Schema.Union([MembershipNotFound, PersistenceUnavailable]),
});
export type RemoveMemberPayload = Command.Payload<typeof RemoveMemberCommand>;
