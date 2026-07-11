import { type RowSchemas } from "@org/database/index";
import * as DateTime from "effect/DateTime";

import { DeviceGrantId } from "@/modules/auth/domain/device-grant/device-grant.id.js";
import { DeviceGrantRoot } from "@/modules/auth/domain/device-grant/device-grant.root.js";
import { UserId } from "@/platform/ids/user-id.js";

export const toDomain = (row: RowSchemas.DeviceGrantRow): DeviceGrantRoot =>
  DeviceGrantRoot.make({
    id: DeviceGrantId.make(row.id),
    deviceCodeHash: row.device_code_hash,
    userCode: row.user_code,
    // The column is a free-text varchar at the DB level; collapse anything
    // other than the approved sentinel to pending.
    status: row.status === "approved" ? "approved" : "pending",
    userId: row.user_id === null ? null : UserId.make(row.user_id),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    approvedAt: row.approved_at,
  });

export const toPersistence = (grant: DeviceGrantRoot) => ({
  id: grant.id,
  device_code_hash: grant.deviceCodeHash,
  user_code: grant.userCode,
  status: grant.status,
  user_id: grant.userId,
  created_at: DateTime.toDate(grant.createdAt),
  expires_at: DateTime.toDate(grant.expiresAt),
  approved_at: grant.approvedAt === null ? null : DateTime.toDate(grant.approvedAt),
});
