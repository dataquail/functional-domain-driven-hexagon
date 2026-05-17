import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";
import * as Layer from "effect/Layer";

// Pass-through `UnitOfWork` for unit tests that drive use cases against
// fake repositories. Inner effects run as-is; no SQL transaction is opened
// and no `TransactionContext` is provided (fake repos don't consult it).
// Production wires `UnitOfWorkLive` instead.
export const IdentityUnitOfWork: Layer.Layer<UnitOfWork> = Layer.succeed(
  UnitOfWork,
  UnitOfWork.of({
    run: (effect) => effect as never,
  }),
);
