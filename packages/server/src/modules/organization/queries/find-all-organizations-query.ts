import { type Database } from "@org/database/index";
import type * as DateTime from "effect/DateTime";
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type PersistenceUnavailable } from "@/platform/ddd/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/span-attributable.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";

// Admin-side listing of every org. `includeDeleted` is the explicit
// opt-in for the soft-delete recycling-bin view; by default the
// query filters tombstones out so the regular admin browse doesn't
// surface them.
export const FindAllOrganizationsQuery = Schema.TaggedStruct("FindAllOrganizationsQuery", {
  page: Schema.Number,
  pageSize: Schema.Number,
  includeDeleted: Schema.Boolean,
});
export type FindAllOrganizationsQuery = typeof FindAllOrganizationsQuery.Type;

export const findAllOrganizationsQuerySpanAttributes: SpanAttributesExtractor<
  FindAllOrganizationsQuery
> = (query) => ({
  "query.page": query.page,
  "query.pageSize": query.pageSize,
  "query.includeDeleted": query.includeDeleted,
});

export type FindAllOrganizationsView = {
  readonly id: OrganizationId;
  readonly name: string;
  readonly createdAt: DateTime.Utc;
  readonly updatedAt: DateTime.Utc;
  readonly deletedAt: DateTime.Utc | null;
};

export type FindAllOrganizationsResult = {
  readonly organizations: ReadonlyArray<FindAllOrganizationsView>;
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
};

export type FindAllOrganizationsOutput = Effect.Effect<
  FindAllOrganizationsResult,
  PersistenceUnavailable,
  Database.Database
>;

declare module "@/platform/ddd/query-bus.js" {
  interface QueryRegistry {
    FindAllOrganizationsQuery: {
      readonly query: FindAllOrganizationsQuery;
      readonly output: FindAllOrganizationsOutput;
    };
  }
}
