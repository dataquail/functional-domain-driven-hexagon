// One-stop composition: every `*RepositoryFakeShared` Layer wired
// over a single `FakeDatabaseLive`. Use this in the behavior
// contract suite, in `@org/test-backend`, or in any test that needs
// cross-repo invariants (FK existence, cascade, unique indexes
// spanning the schema) to be enforced consistently across repos.
//
// Backward compatibility: per-module `XxxRepositoryFake` exports
// continue to bake in their own `FakeDatabaseLive` so existing
// use-case unit tests (`Effect.provide(UserRepositoryFake)`) work
// unchanged. They just don't share state across repos — which is
// fine, since use-case tests rarely need to.

import { AuthIdentityRepositoryFakeShared } from "@/modules/auth/infrastructure/auth-identity-repository-fake.js";
import { SessionRepositoryFakeShared } from "@/modules/auth/infrastructure/session-repository-fake.js";
import { TodosRepositoryFakeShared } from "@/modules/todos/infrastructure/todos-repository-fake.js";
import { UserRepositoryFakeShared } from "@/modules/user/infrastructure/user-repository-fake.js";
import { WalletRepositoryFakeShared } from "@/modules/wallet/infrastructure/wallet-repository-fake.js";
import * as Layer from "effect/Layer";
import { FakeDatabaseLive, type FakeDatabaseTag } from "./fake-database.js";

const SharedRepositoriesLive = Layer.mergeAll(
  UserRepositoryFakeShared,
  WalletRepositoryFakeShared,
  TodosRepositoryFakeShared,
  SessionRepositoryFakeShared,
  AuthIdentityRepositoryFakeShared,
);

// All fake repos backed by a single `FakeDatabase`. `FakeDatabaseTag`
// is re-exported in the success channel so tests can read/seed the
// database directly via `Effect.flatMap(FakeDatabaseTag, ...)`.
export const FakeRepositoriesLive: Layer.Layer<
  Layer.Layer.Success<typeof SharedRepositoriesLive> | FakeDatabaseTag,
  never,
  never
> = SharedRepositoriesLive.pipe(Layer.provideMerge(FakeDatabaseLive));
