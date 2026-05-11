// `@org/test-backend` — the public surface FE integration tests
// import. The actual implementation lives in
// `@org/server/test-utils/in-process-backend.ts` so it has direct
// access to the modules, repositories, and platform services it
// composes.
//
// This package re-exports the bits the FE side needs. It's marked
// `private` and is only consumed as a devDependency by `@org/web`.
//
// Per ADR-0019 (isomorphic stack commitment), this package is the
// realization of the in-process integration tier: same runtime,
// same contracts, no codegen, no parallel fakes.

export {
  startInProcessBackend,
  type AuthControl,
  type InProcessBackend,
  type StartOptions,
} from "@org/server/test-utils/in-process-backend";

export {
  FakeDatabase,
  FakeDatabaseTag,
  ForeignKeyViolation,
  UniqueViolation,
  type FakeDatabaseOptions,
} from "@org/server/test-utils/fake-database";
