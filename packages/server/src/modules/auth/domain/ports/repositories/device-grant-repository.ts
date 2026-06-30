import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type DeviceGrant } from "@/modules/auth/domain/device-grant.aggregate.js";
import { type DeviceGrantNotFound } from "@/modules/auth/domain/device-grant-errors.js";
import { type DeviceGrantId } from "@/modules/auth/domain/device-grant-id.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";

// Dumb collection port (per `feedback_dumb_repositories`). Lookups by the two
// codes the flow keys on: device_code_hash (CLI poll) and user_code (browser
// approve).
export type DeviceGrantRepositoryShape = {
  readonly insertOne: (grant: DeviceGrant) => Effect.Effect<void, PersistenceUnavailable>;
  readonly findOneByCodeHash: (
    deviceCodeHash: string,
  ) => Effect.Effect<DeviceGrant, DeviceGrantNotFound | PersistenceUnavailable>;
  readonly findOneByUserCode: (
    userCode: string,
  ) => Effect.Effect<DeviceGrant, DeviceGrantNotFound | PersistenceUnavailable>;
  readonly updateOne: (
    grant: DeviceGrant,
  ) => Effect.Effect<void, DeviceGrantNotFound | PersistenceUnavailable>;
  // Consumes a grant (single-use) once its token has been issued.
  readonly deleteOne: (
    id: DeviceGrantId,
  ) => Effect.Effect<void, DeviceGrantNotFound | PersistenceUnavailable>;
};

export class DeviceGrantRepository extends Context.Tag("DeviceGrantRepository")<
  DeviceGrantRepository,
  DeviceGrantRepositoryShape
>() {}
