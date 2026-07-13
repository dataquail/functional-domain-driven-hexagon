import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type DeviceGrantNotFound } from "@/modules/auth/domain/device-grant/device-grant.errors.js";
import { type DeviceGrantId } from "@/modules/auth/domain/device-grant/device-grant.id.js";
import { type DeviceGrantRoot } from "@/modules/auth/domain/device-grant/device-grant.root.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";

// Dumb collection port (per `feedback_dumb_repositories`): insert/update the
// aggregate, delete by id, and read it back by a Specification. The lookups the
// flow keys on — device_code_hash (CLI poll) and user_code (browser approve) —
// are expressed as specs at the call site (DeviceGrantSpecifications) and
// compiled to a WHERE fragment by the live repository. Absence is a plain
// `null`, mapped to DeviceGrantNotFound by the caller.
export type DeviceGrantRepositoryShape = {
  readonly insertOne: (grant: DeviceGrantRoot) => Effect.Effect<void, PersistenceUnavailable>;
  readonly findOne: (
    spec: Specification<DeviceGrantRoot>,
  ) => Effect.Effect<DeviceGrantRoot | null, PersistenceUnavailable>;
  readonly updateOne: (
    grant: DeviceGrantRoot,
  ) => Effect.Effect<void, DeviceGrantNotFound | PersistenceUnavailable>;
  // Consumes a grant (single-use) once its token has been issued.
  readonly deleteOne: (
    id: DeviceGrantId,
  ) => Effect.Effect<void, DeviceGrantNotFound | PersistenceUnavailable>;
};

export class DeviceGrantRepository extends Context.Service<
  DeviceGrantRepository,
  DeviceGrantRepositoryShape
>()("DeviceGrantRepository") {}
