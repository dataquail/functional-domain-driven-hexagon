import * as Layer from "effect/Layer";

import { UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";

// Pass-through `UnitOfWork` for unit tests that drive use cases against fake
// repositories. Inner effects run as-is; no SQL transaction is opened and no
// `TransactionContext` is provided (fake repos don't consult it). Unit tests
// pair this with `RecordingEventBus` (and recording integration fakes), which
// don't enforce the dispatch guards, so no buffer or transaction context is
// needed here. Production wires `UnitOfWorkLive` instead.
export const IdentityUnitOfWork: Layer.Layer<UnitOfWork> = Layer.succeed(
  UnitOfWork,
  UnitOfWork.of({
    run: (effect) => effect as never,
  }),
);
