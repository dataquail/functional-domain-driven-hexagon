import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type OrganizationId } from "@/globals/application/ddd/ids/organization-id.js";
import { type UserId } from "@/globals/application/ddd/ids/user-id.js";
import { type PersistenceUnavailable } from "@/globals/application/ddd/persistence-unavailable.js";

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
