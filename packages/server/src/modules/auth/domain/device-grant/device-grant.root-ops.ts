import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import { type UserId } from "@/globals/application/ddd/ids/user-id";

import { UserCodeEntropyExhausted } from "./device-grant.errors";
import { type DeviceGrantId } from "./device-grant.id";
import { DeviceGrantRoot } from "./device-grant.root";

export type StartInput = {
  readonly id: DeviceGrantId;
  readonly deviceCodeHash: string;
  readonly userCode: string;
  readonly now: DateTime.Utc;
  readonly ttlSeconds: number;
};

const start = (input: StartInput): DeviceGrantRoot =>
  DeviceGrantRoot.make({
    id: input.id,
    deviceCodeHash: input.deviceCodeHash,
    userCode: input.userCode,
    status: "pending",
    userId: Option.none(),
    createdAt: input.now,
    expiresAt: DateTime.add(input.now, { seconds: input.ttlSeconds }),
    approvedAt: Option.none(),
  });

export type ApproveInput = {
  readonly grant: DeviceGrantRoot;
  readonly userId: UserId;
  readonly now: DateTime.Utc;
};

// Binds the grant to the approving user. Pure; the use case enforces the
// guards (must be unexpired) before calling. Idempotent on an
// already-approved grant — re-approval just re-stamps.
const approve = (input: ApproveInput): DeviceGrantRoot =>
  DeviceGrantRoot.make({
    id: input.grant.id,
    deviceCodeHash: input.grant.deviceCodeHash,
    userCode: input.grant.userCode,
    status: "approved",
    userId: Option.some(input.userId),
    createdAt: input.grant.createdAt,
    expiresAt: input.grant.expiresAt,
    approvedAt: Option.some(input.now),
  });

// The human-typable user code. Entropy generation (impure) stays in the start
// command; this is the pure formatter it composes — mapping random bytes onto
// a confusable-free alphabet as `XXXX-XXXX`. No 0/O/1/I — easy to mistype.
export const USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// Maps random `bytes` onto the alphabet via rejection sampling: any byte in
// the biased tail (>= the largest multiple of the alphabet length that fits
// in 256) is discarded, so every symbol stays equally likely regardless of
// the alphabet length. For the current 32-char alphabet 256 is an exact
// multiple, so nothing is ever rejected — but the guard keeps the mapping
// uniform if the alphabet ever changes. Caller must supply enough bytes; the
// start command overdraws so exhaustion can't happen in practice.
const toUserCode = (bytes: Uint8Array): Result.Result<string, UserCodeEntropyExhausted> => {
  const n = USER_CODE_ALPHABET.length;
  const limit = 256 - (256 % n);
  let chars = "";

  for (const byte of bytes) {
    if (chars.length >= 8) break;

    if (byte >= limit) continue;
    chars += USER_CODE_ALPHABET.charAt(byte % n);
  }

  if (chars.length < 8) {
    return Result.fail(new UserCodeEntropyExhausted());
  }

  return Result.succeed(`${chars.slice(0, 4)}-${chars.slice(4, 8)}`);
};

export const DeviceGrantRootOps = { start, approve, toUserCode } as const;
