import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type ApiToken } from "@/modules/auth/domain/api-token.aggregate.js";
import {
  type ApiTokenExpired,
  type ApiTokenNotFound,
  type ApiTokenRevoked,
} from "@/modules/auth/domain/api-token-errors.js";
import { type ApiTokenRepository } from "@/modules/auth/domain/ports/repositories/api-token-repository.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
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

// Raw handler effect — `ApiTokenRepository` is discharged by the wrap in
// `auth-query-handlers.ts`.
export type FindApiTokenByHashOutput = Effect.Effect<
  ApiToken,
  ApiTokenNotFound | ApiTokenExpired | ApiTokenRevoked | PersistenceUnavailable,
  ApiTokenRepository
>;
