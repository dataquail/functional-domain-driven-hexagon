import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";

import { type PersistenceUnavailable } from "@/globals/application/ddd/persistence-unavailable.ts";
import { type Specification } from "@/globals/application/ddd/specification.ts";
import { type DeviceGrantNotFound } from "@/modules/auth/domain/device-grant/device-grant.errors.ts";
import { type DeviceGrantId } from "@/modules/auth/domain/device-grant/device-grant.id.ts";
import { type DeviceGrantRoot } from "@/modules/auth/domain/device-grant/device-grant.root.ts";

// Dumb collection port (per `feedback_dumb_repositories`): insert/update the
// aggregate, delete by id, and read it back by a Specification. The lookups the
// flow keys on — device_code_hash (CLI poll) and user_code (browser approve) —
// are expressed as specs at the call site (DeviceGrantSpecifications) and
// compiled to a WHERE fragment by the live repository. Absence is a plain
// `null`, mapped to DeviceGrantNotFound by the caller.
export type DeviceGrantRepositoryService = {
  readonly insertOne: (grant: DeviceGrantRoot) => Effect.Effect<void, PersistenceUnavailable>;
  readonly findOne: (
    spec: Specification<DeviceGrantRoot>,
  ) => Effect.Effect<Option.Option<DeviceGrantRoot>, PersistenceUnavailable>;
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
  DeviceGrantRepositoryService
>()("DeviceGrantRepository") {}
