// In-memory state shared by every repository fake in a single test
// scope. Models the cross-table invariants enforced by the real
// schema (unique indexes, FK existence, FK cascade) so use-case unit
// tests, in-process integration tests, and the upcoming
// `@org/test-backend` harness all see the same constraint behavior
// without booting Postgres.
//
// Scope discipline (ADR-0019 + remediation plan §7.2): we fake the
// behaviors production code depends on, not all of Postgres. In
// scope: unique indexes, FK existence, FK cascade-vs-restrict per
// table, the domain errors that map from constraint violations. Out
// of scope: transaction isolation levels (fakes are
// serializable-by-construction), query planner behavior, advisory
// locks, trigger semantics, native function semantics.
//
// The contract suite in `repository-behavior/` is the single source
// of truth for "behaviors production code depends on" — if it isn't
// asserted there, fidelity is not guaranteed.

import { type UserId } from "@/platform/ids/user-id.js";
import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { AuthIdentity } from "../modules/auth/domain/auth-identity-repository.js";
import { type SessionId } from "../modules/auth/domain/session-id.js";
import { type Session } from "../modules/auth/domain/session.aggregate.js";
import { type TodoId } from "../modules/todos/domain/todo-id.js";
import { type Todo } from "../modules/todos/domain/todo.js";
import type { User } from "../modules/user/domain/user.aggregate.js";
import { type WalletId } from "../modules/wallet/domain/wallet-id.js";
import { type Wallet } from "../modules/wallet/domain/wallet.aggregate.js";

// ──────────────────────────────────────────────────────────────────
// Schema-level violation errors. Repo fakes catch these and map to
// the module's domain errors (UserAlreadyExists, WalletAlreadyExistsForUser,
// etc.), exactly the way the live repositories catch slonik's
// DatabaseError variants.
// ──────────────────────────────────────────────────────────────────
export class UniqueViolation extends Data.TaggedError("UniqueViolation")<{
  readonly table: string;
  readonly column: string;
}> {}

export class ForeignKeyViolation extends Data.TaggedError("ForeignKeyViolation")<{
  readonly table: string;
  readonly column: string;
}> {}

// ──────────────────────────────────────────────────────────────────
// FakeDatabase
//
// One instance per test scope. Each Map is a table; methods enforce
// invariants by checking other Maps before mutating (e.g. inserting
// into `wallets` requires the userId to exist in `users`). Cascade
// is modeled explicitly in `deleteUser`.
//
// `enforceFks` defaults to true: cross-table FK existence is checked,
// matching the real schema. The behavior contract suite and
// `FakeRepositoriesLive` rely on this. Set to false for the
// backward-compatible per-module fakes, which exist to let use-case
// unit tests work with one repository in isolation without pre-
// seeding rows in other tables.
// ──────────────────────────────────────────────────────────────────
export type FakeDatabaseOptions = {
  readonly enforceFks?: boolean;
};

export class FakeDatabase {
  public readonly users = new Map<UserId, User>();
  public readonly todos = new Map<TodoId, Todo>();
  public readonly wallets = new Map<WalletId, Wallet>();
  public readonly authIdentities = new Map<string, AuthIdentity>();
  public readonly sessions = new Map<SessionId, Session>();

  public readonly enforceFks: boolean;

  constructor(opts: FakeDatabaseOptions = {}) {
    this.enforceFks = opts.enforceFks ?? true;
  }

  // ── users ──────────────────────────────────────────────────────
  public insertUser(user: User): Effect.Effect<void, UniqueViolation> {
    for (const existing of this.users.values()) {
      if (existing.email === user.email) {
        return Effect.fail(new UniqueViolation({ table: "users", column: "email" }));
      }
    }
    this.users.set(user.id, user);
    return Effect.void;
  }

  public updateUser(user: User): Effect.Effect<boolean, UniqueViolation> {
    if (!this.users.has(user.id)) return Effect.succeed(false);
    // Email change must not collide with another row.
    for (const existing of this.users.values()) {
      if (existing.id !== user.id && existing.email === user.email) {
        return Effect.fail(new UniqueViolation({ table: "users", column: "email" }));
      }
    }
    this.users.set(user.id, user);
    return Effect.succeed(true);
  }

  // Schema: wallets.user_id, auth_identities.user_id, sessions.user_id
  // all FK to users with ON DELETE CASCADE. Deleting a user must
  // remove the dependents in the same call.
  public deleteUser(id: UserId): boolean {
    if (!this.users.has(id)) return false;
    this.users.delete(id);
    for (const [walletId, w] of this.wallets) {
      if (w.userId === id) this.wallets.delete(walletId);
    }
    for (const [subject, identity] of this.authIdentities) {
      if (identity.userId === id) this.authIdentities.delete(subject);
    }
    for (const [sid, s] of this.sessions) {
      if (s.userId === id) this.sessions.delete(sid);
    }
    return true;
  }

  // ── todos (no FK to users in the current schema) ───────────────
  public insertTodo(todo: Todo): void {
    this.todos.set(todo.id, todo);
  }

  public updateTodo(todo: Todo): boolean {
    if (!this.todos.has(todo.id)) return false;
    this.todos.set(todo.id, todo);
    return true;
  }

  public deleteTodo(id: TodoId): boolean {
    return this.todos.delete(id);
  }

  // ── wallets ────────────────────────────────────────────────────
  public insertWallet(wallet: Wallet): Effect.Effect<void, UniqueViolation | ForeignKeyViolation> {
    if (this.enforceFks && !this.users.has(wallet.userId)) {
      return Effect.fail(new ForeignKeyViolation({ table: "wallets", column: "user_id" }));
    }
    for (const existing of this.wallets.values()) {
      if (existing.userId === wallet.userId) {
        return Effect.fail(new UniqueViolation({ table: "wallets", column: "user_id" }));
      }
    }
    this.wallets.set(wallet.id, wallet);
    return Effect.void;
  }

  // ── auth identities ────────────────────────────────────────────
  public insertAuthIdentity(identity: AuthIdentity): Effect.Effect<void, ForeignKeyViolation> {
    if (this.enforceFks && !this.users.has(identity.userId)) {
      return Effect.fail(new ForeignKeyViolation({ table: "auth_identities", column: "user_id" }));
    }
    this.authIdentities.set(identity.subject, identity);
    return Effect.void;
  }

  // ── sessions ───────────────────────────────────────────────────
  public insertSession(session: Session): Effect.Effect<void, ForeignKeyViolation> {
    if (this.enforceFks && !this.users.has(session.userId)) {
      return Effect.fail(new ForeignKeyViolation({ table: "sessions", column: "user_id" }));
    }
    this.sessions.set(session.id, session);
    return Effect.void;
  }
}

// ──────────────────────────────────────────────────────────────────
// FakeDatabase as a Layer-provided service.
//
// Repository fakes that want to participate in the shared-state
// model construct from `FakeDatabase` via `Layer.effect`. Tests can
// use `FakeDatabaseLive` to get a fresh instance per scope, or
// pre-build one and use `Layer.succeed(FakeDatabase, db)` to seed
// state before any repo is built.
// ──────────────────────────────────────────────────────────────────
export class FakeDatabaseTag extends Context.Tag("@org/test-utils/FakeDatabase")<
  FakeDatabaseTag,
  FakeDatabase
>() {}

export const FakeDatabaseLive: Layer.Layer<FakeDatabaseTag> = Layer.effect(
  FakeDatabaseTag,
  Effect.sync(() => new FakeDatabase()),
);

// Per-module fake repositories layer over this one. FK checks are
// off so use-case unit tests work in isolation without seeding
// users for every session/wallet/auth-identity insert. The behavior
// contract suite and `FakeRepositoriesLive` use the strict default
// instead.
export const FakeDatabaseRelaxedLive: Layer.Layer<FakeDatabaseTag> = Layer.effect(
  FakeDatabaseTag,
  Effect.sync(() => new FakeDatabase({ enforceFks: false })),
);
