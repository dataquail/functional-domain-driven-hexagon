import { NetworkMonitor } from "@/services/common/network-monitor";
import * as Effect from "effect/Effect";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as SubscriptionRef from "effect/SubscriptionRef";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const dispatchOnline = () => {
  window.dispatchEvent(new Event("online"));
};
const dispatchOffline = () => {
  window.dispatchEvent(new Event("offline"));
};

const waitForRef = <A>(
  ref: SubscriptionRef.SubscriptionRef<A>,
  predicate: (value: A) => boolean,
  timeoutMs = 500,
): Promise<A> =>
  new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      void Effect.runPromise(SubscriptionRef.get(ref)).then((value) => {
        if (predicate(value)) resolve(value);
        else if (Date.now() - start > timeoutMs)
          reject(new Error(`timed out waiting for ref; last value: ${JSON.stringify(value)}`));
        else setTimeout(tick, 5);
      }, reject);
    };
    tick();
  });

let runtime: ManagedRuntime.ManagedRuntime<NetworkMonitor, never>;

beforeEach(() => {
  runtime = ManagedRuntime.make(NetworkMonitor.Default);
});

afterEach(async () => {
  await runtime.dispose();
});

describe("NetworkMonitor", () => {
  it("initializes the ref to window.navigator.onLine", async () => {
    const onLine = await runtime.runPromise(
      Effect.flatMap(NetworkMonitor, (nm) => SubscriptionRef.get(nm.ref)),
    );
    expect(onLine).toBe(window.navigator.onLine);
  });

  it("flips the ref to false when an offline event fires", async () => {
    const ref = await runtime.runPromise(Effect.map(NetworkMonitor, (nm) => nm.ref));
    dispatchOffline();
    const value = await waitForRef(ref, (v) => v === false);
    expect(value).toBe(false);
  });

  it("flips the ref back to true when an online event fires", async () => {
    const ref = await runtime.runPromise(Effect.map(NetworkMonitor, (nm) => nm.ref));
    dispatchOffline();
    await waitForRef(ref, (v) => v === false);
    dispatchOnline();
    const value = await waitForRef(ref, (v) => v === true);
    expect(value).toBe(true);
  });

  it("opens the latch when online and closes it when offline", async () => {
    const nm = await runtime.runPromise(NetworkMonitor);

    // Latch starts open (true). An offline event closes it; an online event
    // re-opens it. We probe the latch by racing `latch.await` against a
    // bounded timeout — `await` resolves immediately when open and blocks
    // when closed.
    const probe = (timeoutMs: number) =>
      runtime.runPromise(
        Effect.race(
          nm.latch.await.pipe(Effect.as("open" as const)),
          Effect.sleep(`${timeoutMs} millis`).pipe(Effect.as("blocked" as const)),
        ),
      );

    expect(await probe(20)).toBe("open");

    dispatchOffline();
    await waitForRef(nm.ref, (v) => v === false);
    expect(await probe(20)).toBe("blocked");

    dispatchOnline();
    await waitForRef(nm.ref, (v) => v === true);
    expect(await probe(20)).toBe("open");
  });
});
