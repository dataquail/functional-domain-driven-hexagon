import * as Schema from "effect/Schema";

import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";

// Per-request bearer lookup, dispatched by the auth middleware. The caller
// hashes the presented token before dispatch, so the raw secret never
// travels through the bus or a span. Validates lifecycle (revoked /
// expired) the same way `FindSessionQuery` does for cookies.
export const FindApiTokenByHashQuery = Schema.TaggedStruct("FindApiTokenByHashQuery", {
  tokenHash: Schema.String,
});
export type FindApiTokenByHashQuery = typeof FindApiTokenByHashQuery.Type;

// Deliberately empty: `tokenHash` is secret-derived and must not land in a span.
export const findApiTokenByHashQuerySpanAttributes: SpanAttributesExtractor<
  FindApiTokenByHashQuery
> = () => ({});
