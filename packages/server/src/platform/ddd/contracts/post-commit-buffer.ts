import * as Context from "effect/Context";
import type * as Ref from "effect/Ref";

import { type DomainEvent } from "@/platform/ddd/contracts/domain-event.js";

// Buffer for integration (post-commit) events accumulated during a unit of
// work. `IntegrationEventBus.dispatch` appends here instead of running
// handlers inline; the OUTERMOST `UnitOfWork.run` drains it AFTER its
// transaction commits, running each handler in its own fresh transaction.
// That is the eventual-consistency half of the two-bus model (ADR-0007's
// in-fiber bus is the immediate half).
//
// A fresh buffer is provided by the outermost `run`. A nested savepoint
// snapshots the buffer length on entry and truncates back to it on rollback,
// so integration events emitted inside a rolled-back savepoint never flush.
//
// Lives in `contracts/` rather than `ports/`: it is a domain-safe carrier
// (just a `Ref`), with no application-tier behavior. Both the integration
// bus and the unit of work reference it without taking on a service dependency.
export class PostCommitBuffer extends Context.Service<
  PostCommitBuffer,
  Ref.Ref<ReadonlyArray<DomainEvent>>
>()("PostCommitBuffer") {}
