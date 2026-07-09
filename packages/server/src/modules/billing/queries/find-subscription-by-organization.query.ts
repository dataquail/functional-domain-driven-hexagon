import type * as DateTime from "effect/DateTime";
import type * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { type SubscriptionId } from "@/modules/billing/domain/subscription.id.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

export const FindSubscriptionByOrganizationQuery = Schema.TaggedStruct(
  "FindSubscriptionByOrganizationQuery",
  { organizationId: OrganizationId },
);
export type FindSubscriptionByOrganizationQuery = typeof FindSubscriptionByOrganizationQuery.Type;

export type SubscriptionView = {
  readonly id: SubscriptionId;
  readonly organizationId: OrganizationId;
  readonly status: string;
  readonly currentPeriodEnd: DateTime.Utc | null;
};

export type FindSubscriptionByOrganizationResult = Option.Option<SubscriptionView>;

export const findSubscriptionByOrganizationQuerySpanAttributes: SpanAttributesExtractor<
  FindSubscriptionByOrganizationQuery
> = (q) => ({ "organization.id": q.organizationId });
