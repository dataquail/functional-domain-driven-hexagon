import * as DateTime from "effect/DateTime";

import { Spec, type Specification } from "@/platform/ddd/contracts/specification.js";

import { type DeviceGrantRoot } from "./device-grant.root.js";

// Translatable specs (carry a Criteria → usable as repository filters and as
// in-memory guards). The field-name strings live here and in the mapper's
// column map; `Spec.eq` types them against DeviceGrantRoot so a typo is a
// compile error.
const withCodeHash = (deviceCodeHash: string): Specification<DeviceGrantRoot> =>
  Spec.eq<DeviceGrantRoot, "deviceCodeHash">("deviceCodeHash", deviceCodeHash);
const withUserCode = (userCode: string): Specification<DeviceGrantRoot> =>
  Spec.eq<DeviceGrantRoot, "userCode">("userCode", userCode);

// Eval-only (a plain predicate, not a Specification): DateTime comparison has
// no Criteria node, so it never needs SQL translation. It stays a guard used
// in the poll/approve handlers.
const isExpired = (grant: DeviceGrantRoot, now: DateTime.Utc): boolean =>
  DateTime.isLessThanOrEqualTo(grant.expiresAt, now);

export const DeviceGrantSpecifications = { withCodeHash, withUserCode, isExpired } as const;
