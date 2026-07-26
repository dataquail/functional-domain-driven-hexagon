import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { OrganizationAccess } from "@/modules/billing/domain/ports/acl/organization-access.acl.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";
import { type UserId } from "@/platform/ids/user-id.js";

// In-memory `OrganizationAccess` for policy and use-case unit tests. Seed each
// relation as a `${userId}::${organizationId}` key. Admins are not implicitly
// members — seed both when a test needs both, so a test that only grants admin
// still exercises the read/mutate split honestly.
export const accessKey = (userId: UserId, organizationId: OrganizationId) =>
  `${userId}::${organizationId}`;

export const makeOrganizationAccessFake = (seed?: {
  readonly members?: ReadonlySet<string>;
  readonly admins?: ReadonlySet<string>;
}) => {
  const members = seed?.members ?? new Set<string>();
  const admins = seed?.admins ?? new Set<string>();

  return Layer.succeed(
    OrganizationAccess,
    OrganizationAccess.of({
      isMember: (userId, organizationId) =>
        Effect.succeed(members.has(accessKey(userId, organizationId))),
      isAdmin: (userId, organizationId) =>
        Effect.succeed(admins.has(accessKey(userId, organizationId))),
    }),
  );
};
