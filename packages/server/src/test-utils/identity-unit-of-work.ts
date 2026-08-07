import { EventBus, UnitOfWork, UnitOfWorkScope } from "@org/cqrs";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";

import { type DomainEvent } from "@/platform/ddd/contracts/domain-event.js";

// Pass-through `UnitOfWork` for unit tests that drive use cases against fake
// repositories. Inner effects run as-is and no SQL transaction is opened, so
// fake repositories — which never consult one — work unchanged.
//
// It does open a `UnitOfWorkScope`, because it *is* a unit of work: without one,
// a use case dispatching a domain event through a real bus would hit the
// "did you forget withUnitOfWork?" guard, which would be a lie in a test that
// wrapped its subject correctly.
//
// It drains that scope on the way out for the same reason: an after-commit
// subscriber that never ran would make a passing test meaningless. Failures are
// left to propagate rather than isolated the way the real boundary isolates
// them — a broken reaction should fail its test loudly.
export const IdentityUnitOfWork: Layer.Layer<UnitOfWork> = Layer.succeed(
  UnitOfWork,
  UnitOfWork.of({
    run: (effect) =>
      Effect.gen(function* () {
        const postCommitEvents = yield* Ref.make<ReadonlyArray<DomainEvent>>([]);
        const result = yield* Effect.provideService(effect, UnitOfWorkScope, { postCommitEvents });

        const bus = yield* Effect.serviceOption(EventBus);
        if (Option.isNone(bus)) return result;
        const buffered = yield* Ref.get(postCommitEvents);
        yield* bus.value.broadcast(buffered);
        for (const event of buffered) {
          const handlers = yield* bus.value.afterCommitHandlersFor(event._tag);
          yield* Effect.forEach(handlers, (handler) => handler(event), { discard: true });
        }
        return result;
      }) as never,
  }),
);
