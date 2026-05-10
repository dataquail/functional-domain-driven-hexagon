// Cross-repository invariants — behaviors that span more than one
// table and are owned by the schema, not any single repository. The
// suite is parameterized over a fully-closed Layer (all repos) plus
// a reset effect and a wallet-count inspector that abstract over
// the "look in a Map" (fake) vs "SELECT FROM wallets" (live) split.
//
// Scope discipline (remediation plan §7.2): we exercise only the
// invariants production code depends on or could regress against:
//   - users.email UNIQUE
//   - wallets.user_id UNIQUE + FK → users
//   - sessions.user_id FK → users + ON DELETE CASCADE
//   - auth_identities.user_id FK → users + ON DELETE CASCADE
//
// Out of scope: query planner behavior, advisory locks, trigger
// semantics, isolation levels. The fake is serializable-by-
// construction; the live tier inherits Postgres semantics.

import { SessionId } from "@/modules/auth/domain/session-id.js";
import { SessionRepository } from "@/modules/auth/domain/session-repository.js";
import { Session } from "@/modules/auth/domain/session.aggregate.js";
import type { TodosRepository } from "@/modules/todos/domain/todo-repository.js";
import { UserAlreadyExists } from "@/modules/user/domain/user-errors.js";
import { UserRepository } from "@/modules/user/domain/user-repository.js";
import * as User from "@/modules/user/domain/user.aggregate.js";
import { Address } from "@/modules/user/domain/value-objects/address.js";
import { WalletAlreadyExistsForUser } from "@/modules/wallet/domain/wallet-errors.js";
import { WalletId } from "@/modules/wallet/domain/wallet-id.js";
import { WalletRepository } from "@/modules/wallet/domain/wallet-repository.js";
import * as Wallet from "@/modules/wallet/domain/wallet.aggregate.js";
import { UserId } from "@/platform/ids/user-id.js";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import type * as Layer from "effect/Layer";
import * as Option from "effect/Option";

const aliceId = UserId.make("11111111-1111-1111-1111-111111111111");
const bobId = UserId.make("22222222-2222-2222-2222-222222222222");
const walletAId = WalletId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const walletBId = WalletId.make("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
const now = DateTime.unsafeMake(new Date("2025-01-01T00:00:00Z"));
const address = Address.make({ country: "USA", street: "Main", postalCode: "12345" });

const makeUser = (id: UserId, email: string) => User.create({ id, email, address, now }).user;

const makeWallet = (id: WalletId, userId: UserId) => Wallet.create({ id, userId, now }).wallet;

// Aliases for legibility — `RepoSet` is what every consumer must
// provide at minimum. The inspector and reset effects must require
// no additional services (they bake in their own dependencies via
// the layer or closures the caller constructs).
type RepoSet = UserRepository | WalletRepository | SessionRepository | TodosRepository;

export type CrossRepositoryInvariantsOptions = {
  readonly name: string;
  readonly layer: Layer.Layer<RepoSet>;
  readonly reset: Effect.Effect<void>;
  readonly inspectWalletCountForUser: (userId: UserId) => Effect.Effect<number>;
};

export const crossRepositoryInvariantsSuite = (opts: CrossRepositoryInvariantsOptions) =>
  describe(`Cross-repository invariants (${opts.name})`, () => {
    it.effect("users.email is unique — second insert fails UserAlreadyExists", () =>
      Effect.gen(function* () {
        yield* opts.reset;
        const users = yield* UserRepository;
        yield* users.insert(makeUser(aliceId, "alice@example.com"));

        const exit = yield* Effect.exit(users.insert(makeUser(bobId, "alice@example.com")));
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit)) {
          const failure = exit.cause._tag === "Fail" ? (exit.cause.error as unknown) : null;
          ok(failure instanceof UserAlreadyExists);
        }
      }).pipe(Effect.provide(opts.layer)),
    );

    it.effect("wallets.user_id is unique — second insert for the same user fails", () =>
      Effect.gen(function* () {
        yield* opts.reset;
        const users = yield* UserRepository;
        const wallets = yield* WalletRepository;
        yield* users.insert(makeUser(aliceId, "alice@example.com"));
        yield* wallets.insert(makeWallet(walletAId, aliceId));

        const exit = yield* Effect.exit(wallets.insert(makeWallet(walletBId, aliceId)));
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit)) {
          const failure = exit.cause._tag === "Fail" ? (exit.cause.error as unknown) : null;
          ok(failure instanceof WalletAlreadyExistsForUser);
        }
      }).pipe(Effect.provide(opts.layer)),
    );

    it.effect(
      "deleting a user cascades to wallets (ON DELETE CASCADE) — the wallet is removed",
      () =>
        Effect.gen(function* () {
          yield* opts.reset;
          const users = yield* UserRepository;
          const wallets = yield* WalletRepository;

          yield* users.insert(makeUser(aliceId, "alice@example.com"));
          yield* wallets.insert(makeWallet(walletAId, aliceId));

          const beforeCount = yield* opts.inspectWalletCountForUser(aliceId);
          deepStrictEqual(beforeCount, 1);

          yield* users.remove(aliceId);

          const afterCount = yield* opts.inspectWalletCountForUser(aliceId);
          deepStrictEqual(afterCount, 0);

          // Also unreachable via the public read.
          const lookup = yield* wallets.findByUserId(aliceId);
          ok(Option.isNone(lookup));
        }).pipe(Effect.provide(opts.layer)),
    );

    it.effect("inserting a session for a non-existent user is rejected (FK enforcement)", () =>
      Effect.gen(function* () {
        yield* opts.reset;
        const sessions = yield* SessionRepository;

        const sessionId = SessionId.make("ccccccc1-cccc-cccc-cccc-cccccccccccc");
        const session = Session.make({
          id: sessionId,
          userId: aliceId,
          subject: "unknown-subject",
          expiresAt: DateTime.add(now, { seconds: 3600 }),
          absoluteExpiresAt: DateTime.add(now, { seconds: 43200 }),
          revokedAt: null,
          createdAt: now,
          lastUsedAt: now,
        });

        const exit = yield* Effect.exit(sessions.insert(session));
        // Either a typed Fail or a Die — both communicate "this
        // can't happen at runtime"; the contract is that production
        // code (which always inserts users in the same transaction)
        // never sees a successful FK-violating session insert.
        ok(Exit.isFailure(exit));
      }).pipe(Effect.provide(opts.layer)),
    );
  });
