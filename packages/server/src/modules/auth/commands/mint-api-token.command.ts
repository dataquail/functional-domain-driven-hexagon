import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type ApiTokenRoot } from "@/modules/auth/domain/api-token.root.js";
import { type ApiTokenRepository } from "@/modules/auth/domain/ports/repositories/api-token.repository.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { type UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";
import { UserId } from "@/platform/ids/user-id.js";

// Mints a new API token for the caller. `expiresInDays` is resolved by the
// endpoint (payload value or the configured default) so the handler can
// compute `expiresAt` against the server clock — no client/server skew.
export const MintApiTokenCommand = Schema.TaggedStruct("MintApiTokenCommand", {
  userId: UserId,
  label: Schema.String,
  expiresInDays: Schema.Number,
});
export type MintApiTokenCommand = typeof MintApiTokenCommand.Type;

export const mintApiTokenCommandSpanAttributes: SpanAttributesExtractor<MintApiTokenCommand> = (
  c,
) => ({ "user.id": c.userId });

// The resolved inputs the mint core needs. The command is one source of
// these; the device-flow poll is another (it mints on the user's behalf).
export type MintApiTokenInput = {
  readonly userId: UserId;
  readonly label: string;
  readonly expiresInDays: number;
};

// The plaintext `token` is returned to the caller exactly once (the endpoint
// surfaces it); only its hash is persisted on `apiToken`.
export type MintApiTokenResult = {
  readonly apiToken: ApiTokenRoot;
  readonly token: string;
};

// Raw handler effect — `ApiTokenRepository` is discharged by the wrap in
// `auth-command-handlers.ts`; `UnitOfWork` is reintroduced by `withUnitOfWork`.
export type MintApiTokenOutput = Effect.Effect<
  MintApiTokenResult,
  PersistenceUnavailable,
  ApiTokenRepository | UnitOfWork
>;
