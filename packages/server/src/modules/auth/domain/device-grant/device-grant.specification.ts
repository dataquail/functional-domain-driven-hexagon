import * as DateTime from "effect/DateTime";

import { type DeviceGrantRoot } from "./device-grant.root.js";

const isExpired = (grant: DeviceGrantRoot, now: DateTime.Utc): boolean =>
  DateTime.isLessThanOrEqualTo(grant.expiresAt, now);

export const DeviceGrantSpecifications = { isExpired } as const;
