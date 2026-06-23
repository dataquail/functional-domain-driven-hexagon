import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import {
  type DeviceGrantExpired,
  type DeviceGrantNotFound,
} from "@/modules/auth/domain/device-grant-errors.js";
import { type DeviceGrantRepository } from "@/modules/auth/domain/ports/repositories/device-grant-repository.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { type UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";
import { UserId } from "@/platform/ids/user-id.js";

// Browser-side approval: the signed-in user submits the `userCode` they were
// shown by the CLI; we bind the grant to them.
export const ApproveDeviceGrantCommand = Schema.TaggedStruct("ApproveDeviceGrantCommand", {
  userCode: Schema.String,
  userId: UserId,
});
export type ApproveDeviceGrantCommand = typeof ApproveDeviceGrantCommand.Type;

export const approveDeviceGrantCommandSpanAttributes: SpanAttributesExtractor<
  ApproveDeviceGrantCommand
> = (c) => ({ "user.id": c.userId });

export type ApproveDeviceGrantOutput = Effect.Effect<
  void,
  DeviceGrantNotFound | DeviceGrantExpired | PersistenceUnavailable,
  DeviceGrantRepository | UnitOfWork
>;
