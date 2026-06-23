import { type Database } from "@org/database/index";
import * as Effect from "effect/Effect";

// No-op `TransactionContext` value for unit tests that dispatch domain events
// through the real bus outside a real unit of work. In production, dispatch
// always happens inside `UnitOfWork.run`, which provides the live transaction
// context; the bus guards on its presence (ADR-0007). Fake repositories never
// consult the client, so this just satisfies that guard without a database.
//
// Exposed as the bare value (not a pre-built `.provide` pipeable or `Layer`):
// call `Database.TransactionContext.provide(fakeTransaction)` inline at the use
// site. Storing the generic `provide` result in a const, or wrapping it in
// `Layer.succeed`, trips a tsc inference assertion under `tsc -b`.
export const fakeTransaction: Parameters<typeof Database.TransactionContext.provide>[0] = (fn) =>
  Effect.promise(() => fn(undefined as never));
