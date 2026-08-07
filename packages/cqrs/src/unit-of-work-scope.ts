import * as Context from "effect/Context";
import type * as Ref from "effect/Ref";

import type * as Event from "./event.js";

/**
 * Present exactly while a unit of work is open, and the carrier for the state
 * that lives as long as one.
 *
 * Its presence is the answer to "am I inside a unit of work?", which is what
 * both event buses fail fast on — dispatching outside a unit of work almost
 * always means a forgotten boundary, and the alternatives are worse than a
 * defect: the immediate bus would run subscribers with no transaction to
 * inherit, and the eventual bus would buffer events nothing will ever drain.
 *
 * It is a separate module from the unit of work because the unit of work reads
 * the eventual bus to flush it, and that bus reads this scope — routing both
 * through a carrier is what keeps the dependency acyclic.
 *
 * `postCommitEvents` accumulates during the unit of work; the outermost run
 * drains it after its scope commits, and a rolled-back nested scope truncates
 * it back to its length on entry so events from work that was undone never fire.
 */
export class UnitOfWorkScope extends Context.Service<
  UnitOfWorkScope,
  { readonly postCommitEvents: Ref.Ref<ReadonlyArray<Event.Base>> }
>()("@org/cqrs/UnitOfWorkScope") {}
