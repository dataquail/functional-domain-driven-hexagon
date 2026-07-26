import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";
import { type UserId } from "@/platform/ids/user-id.js";

// ADR-0022 outbound port. Every todos policy gates on "is this caller a member
// of the todo's org?", which only the organization module can answer. One port
// per upstream module, narrowed to what todos asks — a second question for the
// same module would join this port rather than start a new one.
export type OrganizationAccessShape = {
  readonly isMember: (
    userId: UserId,
    organizationId: OrganizationId,
  ) => Effect.Effect<boolean, PersistenceUnavailable>;
};

export class OrganizationAccess extends Context.Service<
  OrganizationAccess,
  OrganizationAccessShape
>()("@org/server/todos/OrganizationAccess") {}
