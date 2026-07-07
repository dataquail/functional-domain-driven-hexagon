import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type MintApiTokenResult } from "@/modules/auth/commands/mint-api-token.command.js";
import {
  type DeviceGrantExpired,
  type DeviceGrantNotFound,
  type DeviceGrantPending,
} from "@/modules/auth/domain/device-grant.errors.js";
import { type ApiTokenRepository } from "@/modules/auth/domain/ports/repositories/api-token.repository.js";
import { type DeviceGrantRepository } from "@/modules/auth/domain/ports/repositories/device-grant.repository.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { type UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";

// CLI poll: exchange a device code for an app token once the grant is
// approved. `tokenExpiresInDays` is resolved by the endpoint from config.
export const PollDeviceGrantCommand = Schema.TaggedStruct("PollDeviceGrantCommand", {
  deviceCode: Schema.String,
  tokenExpiresInDays: Schema.Number,
});
export type PollDeviceGrantCommand = typeof PollDeviceGrantCommand.Type;

// Deliberately empty: `deviceCode` is secret-derived and must not land in a span.
export const pollDeviceGrantCommandSpanAttributes: SpanAttributesExtractor<
  PollDeviceGrantCommand
> = () => ({});

// On success returns a freshly-minted token (plaintext once) — same shape as
// the mint command, since the poll consumes the grant and mints on approval.
export type PollDeviceGrantOutput = Effect.Effect<
  MintApiTokenResult,
  DeviceGrantNotFound | DeviceGrantExpired | DeviceGrantPending | PersistenceUnavailable,
  DeviceGrantRepository | ApiTokenRepository | UnitOfWork
>;
