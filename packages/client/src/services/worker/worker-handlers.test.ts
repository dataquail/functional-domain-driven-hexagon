import * as WorkerHandlers from "@/services/worker/worker-handlers";
import { FilterError } from "@/services/worker/worker-rpc";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { describe, expect, it } from "vitest";

describe("isPrime", () => {
  it.each([
    [-1, false],
    [0, false],
    [1, false],
    [2, true],
    [3, true],
    [4, false],
    [5, true],
    [9, false],
    [25, false],
    [29, true],
    [97, true],
    [100, false],
  ])("isPrime(%i) === %s", (n, expected) => {
    expect(WorkerHandlers.isPrime(n)).toBe(expected);
  });
});

describe("filterData", () => {
  it("returns elements strictly greater than the threshold", async () => {
    const result = await Effect.runPromise(
      WorkerHandlers.filterData({ data: [1, 2, 3, 4, 5], threshold: 3 }),
    );
    expect(result).toEqual([4, 5]);
  });

  it("returns an empty array when no element exceeds the threshold", async () => {
    const result = await Effect.runPromise(
      WorkerHandlers.filterData({ data: [1, 2, 3], threshold: 100 }),
    );
    expect(result).toEqual([]);
  });

  it("threshold of 0 keeps positives and drops zeros and negatives", async () => {
    const result = await Effect.runPromise(
      WorkerHandlers.filterData({ data: [-1, 0, 1, 2], threshold: 0 }),
    );
    expect(result).toEqual([1, 2]);
  });

  it("fails with FilterError when the threshold is negative", async () => {
    const exit = await Effect.runPromiseExit(
      WorkerHandlers.filterData({ data: [1, 2, 3], threshold: -1 }),
    );
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
      expect(exit.cause.error).toBeInstanceOf(FilterError);
      expect(exit.cause.error.message).toBe("Threshold cannot be negative");
    } else {
      throw new Error("expected typed Fail");
    }
  });
});

describe("calculatePrimes", () => {
  it.each([
    [1, 0],
    [2, 1],
    [10, 4], // 2, 3, 5, 7
    [20, 8], // 2, 3, 5, 7, 11, 13, 17, 19
    [100, 25],
  ])("counts primes up to %i = %i", async (upperBound, expected) => {
    const result = await Effect.runPromise(WorkerHandlers.calculatePrimes({ upperBound }));
    expect(result).toBe(expected);
  });
});
