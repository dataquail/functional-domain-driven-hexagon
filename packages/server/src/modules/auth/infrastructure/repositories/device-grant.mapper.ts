import { type RowSchemas } from "@org/database/index";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";

import { UserId } from "@/globals/application/ddd/ids/user-id.ts";
import { type ColumnMap } from "@/globals/infrastructure/database/criteria-to-sql.ts";
import { DeviceGrantId } from "@/modules/auth/domain/device-grant/device-grant.id.ts";
import { DeviceGrantRoot } from "@/modules/auth/domain/device-grant/device-grant.root.ts";

// Resolves the specification field names the live repository filters on to
// physical columns of auth.device_grants. Only filterable scalar fields need an
// entry; `satisfies` keeps the keys honest against the root.
export const columns = {
  deviceCodeHash: "device_code_hash",
  userCode: "user_code",
} as const satisfies Partial<Record<keyof DeviceGrantRoot, string>> & ColumnMap;

// The column is a free-text varchar at the DB level; collapse anything other
// than the approved sentinel to pending.
const toStatus = (status: string): DeviceGrantRoot["status"] => {
  if (status === "approved") return "approved";

  return "pending";
};

export const toDomain = (row: RowSchemas.DeviceGrantRow): DeviceGrantRoot =>
  DeviceGrantRoot.make({
    id: DeviceGrantId.make(row.id),
    deviceCodeHash: row.device_code_hash,
    userCode: row.user_code,
    status: toStatus(row.status),
    userId: Option.map(Option.fromNullOr(row.user_id), UserId.make),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    approvedAt: Option.fromNullOr(row.approved_at),
  });

export const toPersistence = (grant: DeviceGrantRoot) => ({
  id: grant.id,
  device_code_hash: grant.deviceCodeHash,
  user_code: grant.userCode,
  status: grant.status,
  user_id: Option.getOrNull(grant.userId),
  created_at: DateTime.toDate(grant.createdAt),
  expires_at: DateTime.toDate(grant.expiresAt),
  approved_at: Option.getOrNull(Option.map(grant.approvedAt, DateTime.toDate)),
});
