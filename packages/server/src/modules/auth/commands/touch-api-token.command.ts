import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { ApiTokenId } from "@/modules/auth/domain/api-token.id.js";
import { type ApiTokenRepository } from "@/modules/auth/domain/ports/repositories/api-token.repository.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";

// Records last-used time for a token, dispatched by the auth middleware
// after a successful bearer lookup. Throttled + race-tolerant in the handler
// (mirrors `TouchSessionCommand`), so it's safe to fire on every request.
// Unlike sessions there is no sliding TTL — this only stamps `lastUsedAt`.
export const TouchApiTokenCommand = Schema.TaggedStruct("TouchApiTokenCommand", {
  apiTokenId: ApiTokenId,
  thresholdSeconds: Schema.Number,
});
export type TouchApiTokenCommand = typeof TouchApiTokenCommand.Type;

export const touchApiTokenCommandSpanAttributes: SpanAttributesExtractor<TouchApiTokenCommand> = (
  c,
) => ({ "auth.api_token.id": c.apiTokenId });

// Raw handler effect — `ApiTokenRepository` is discharged by the wrap in
// `auth-command-handlers.ts`. Errors are swallowed (benign races / transient
// store), so the channel is `never`.
export type TouchApiTokenOutput = Effect.Effect<void, never, ApiTokenRepository>;
