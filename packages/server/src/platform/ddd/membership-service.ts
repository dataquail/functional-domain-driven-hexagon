import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type PersistenceUnavailable } from "@/platform/ddd/persistence-unavailable.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";
import { type UserId } from "@/platform/ids/user-id.js";

// Cross-module ACL service exposing "is this user a member of this
// org?" to policies. Mirrors `RoleService`'s shape — a generalized
// boolean question that consuming policies (currently org's `IsMember`,
// future modules' policies as Phase 4 wires the grant ACL) can ask
// without importing the org module's `MembershipRepository` type.
//
// Initial Phase 3 introduction is driven solely by the `IsMember`
// policy. The architectural promote-to-ACL bar from the "saved
// feedback" memo ("two or more consumers") technically isn't met yet,
// but the depcruise's cross-module-barrel rule + the resulting cycle
// (org barrel ⇄ policy-registry) makes the inline-Repository shortcut
// untenable; the ACL is the cleanest fix.
export type MembershipServiceShape = {
  readonly isMember: (
    userId: UserId,
    organizationId: OrganizationId,
  ) => Effect.Effect<boolean, PersistenceUnavailable>;
};

export class MembershipService extends Context.Tag("MembershipService")<
  MembershipService,
  MembershipServiceShape
>() {}
