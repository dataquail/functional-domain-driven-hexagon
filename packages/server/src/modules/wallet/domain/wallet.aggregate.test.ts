import { WalletId } from "@/modules/wallet/domain/wallet-id.js";
import * as Wallet from "@/modules/wallet/domain/wallet.aggregate.js";
import { UserId } from "@/platform/ids/user-id.js";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";
import * as DateTime from "effect/DateTime";

const walletId = WalletId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const now = DateTime.unsafeMake(new Date("2025-01-01T00:00:00Z"));

describe("Wallet.create", () => {
  it("constructs a wallet with balance 0 and the given ids/timestamps", () => {
    const { wallet } = Wallet.create({ id: walletId, userId, now });
    deepStrictEqual(wallet.id, walletId);
    deepStrictEqual(wallet.userId, userId);
    deepStrictEqual(wallet.balance, 0);
    deepStrictEqual(wallet.createdAt, now);
    deepStrictEqual(wallet.updatedAt, now);
  });

  it("emits exactly one WalletCreated event carrying the wallet and user ids", () => {
    const { events } = Wallet.create({ id: walletId, userId, now });
    deepStrictEqual(events.length, 1);
    const event = events[0];
    ok(event !== undefined);
    deepStrictEqual(event._tag, "WalletCreated");
    deepStrictEqual(event.walletId, walletId);
    deepStrictEqual(event.userId, userId);
  });
});
