import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { OrganizationAccess } from "@/modules/todos/domain/ports/acl/organization-access.acl.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";
import { type UserId } from "@/platform/ids/user-id.js";

// In-memory `OrganizationAccess` for policy and use-case unit tests. Seed the
// memberships as `${userId}::${organizationId}` keys.
export const membershipKey = (userId: UserId, organizationId: OrganizationId) =>
  `${userId}::${organizationId}`;

export const makeOrganizationAccessFake = (memberships: ReadonlySet<string> = new Set()) =>
  Layer.succeed(
    OrganizationAccess,
    OrganizationAccess.of({
      isMember: (userId, organizationId) =>
        Effect.succeed(memberships.has(membershipKey(userId, organizationId))),
    }),
  );
