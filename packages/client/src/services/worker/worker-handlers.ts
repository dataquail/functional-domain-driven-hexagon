import * as Effect from "effect/Effect";
import { FilterError } from "./worker-rpc";

// Pure handler logic, separated from worker.ts so it can be unit-tested
// without a Web Worker runtime. worker.ts still wraps these in
// `WorkerRpc.toLayer` and adds RPC-level concerns (logging, the demo
// `Effect.sleep` that simulates a long task).

export const isPrime = (num: number): boolean => {
  if (num <= 1) return false;
  if (num <= 3) return true;
  if (num % 2 === 0 || num % 3 === 0) return false;
  for (let i = 5; i * i <= num; i = i + 6) {
    if (num % i === 0 || num % (i + 2) === 0) return false;
  }
  return true;
};

export const filterData = (input: {
  readonly data: ReadonlyArray<number>;
  readonly threshold: number;
}): Effect.Effect<ReadonlyArray<number>, FilterError> =>
  Effect.gen(function* () {
    if (input.threshold < 0) {
      return yield* new FilterError({ message: "Threshold cannot be negative" });
    }
    return input.data.filter((n) => n > input.threshold);
  });

export const calculatePrimes = (input: { readonly upperBound: number }): Effect.Effect<number> =>
  Effect.sync(() => {
    let count = 0;
    for (let i = 2; i <= input.upperBound; i++) {
      if (isPrime(i)) count += 1;
    }
    return count;
  });
