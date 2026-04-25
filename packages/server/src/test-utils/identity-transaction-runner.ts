import { TransactionRunner } from "@/platform/transaction-runner.js";
import * as Layer from "effect/Layer";

// Pass-through `TransactionRunner` for unit tests that drive use cases
// against fake repositories. Inner effects run as-is; no SQL transaction
// is opened and no `TransactionContext` is provided (fake repos don't
// consult it). Production wires `TransactionRunnerLive` instead.
export const IdentityTransactionRunner: Layer.Layer<TransactionRunner> = Layer.succeed(
  TransactionRunner,
  TransactionRunner.of({
    run: (effect) => effect as never,
  }),
);
