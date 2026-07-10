import * as Schema from "effect/Schema";

import { OrganizationId } from "@/platform/ids/organization-id.js";

import { TodoId } from "./todo.id.js";

// Aggregate root data — a dumb value (ADR-0003). Operations live in
// `todo.root-ops.ts` (`TodoRootOps`) and carry the test obligation.
export class TodoRoot extends Schema.Class<TodoRoot>("TodoRoot")({
  id: TodoId,
  // Owning organization. Every todo is scoped to exactly one org
  // (Phase 5 multi-tenancy); the repository requires it on every
  // read/mutate so cross-tenant access can't leak.
  organizationId: OrganizationId,
  title: Schema.String,
  completed: Schema.Boolean,
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
}) {}
