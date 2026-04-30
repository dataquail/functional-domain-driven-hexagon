import { Toast } from "@/services/common/toast";
import * as Effect from "effect/Effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// vi.hoisted + vi.mock are hoisted above all imports at runtime, so it's safe
// to keep regular imports at the top of the file.
const sonnerMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: sonnerMocks,
}));

beforeEach(() => {
  sonnerMocks.success.mockReset();
  sonnerMocks.error.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Toast (Live adapter)", () => {
  it("forwards success messages to sonner.toast.success", async () => {
    await Effect.runPromise(
      Effect.flatMap(Toast, (t) => t.success("saved")).pipe(Effect.provide(Toast.Default)),
    );
    expect(sonnerMocks.success).toHaveBeenCalledTimes(1);
    expect(sonnerMocks.success).toHaveBeenCalledWith("saved");
    expect(sonnerMocks.error).not.toHaveBeenCalled();
  });

  it("forwards error messages to sonner.toast.error", async () => {
    await Effect.runPromise(
      Effect.flatMap(Toast, (t) => t.error("boom")).pipe(Effect.provide(Toast.Default)),
    );
    expect(sonnerMocks.error).toHaveBeenCalledTimes(1);
    expect(sonnerMocks.error).toHaveBeenCalledWith("boom");
    expect(sonnerMocks.success).not.toHaveBeenCalled();
  });

  it("each call is its own emission (no batching, no dedupe)", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const t = yield* Toast;
        yield* t.success("a");
        yield* t.success("a");
        yield* t.error("b");
      }).pipe(Effect.provide(Toast.Default)),
    );
    expect(sonnerMocks.success).toHaveBeenCalledTimes(2);
    expect(sonnerMocks.success).toHaveBeenNthCalledWith(1, "a");
    expect(sonnerMocks.success).toHaveBeenNthCalledWith(2, "a");
    expect(sonnerMocks.error).toHaveBeenCalledTimes(1);
    expect(sonnerMocks.error).toHaveBeenCalledWith("b");
  });
});
