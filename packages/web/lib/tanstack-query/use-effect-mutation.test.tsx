// Tests for `useEffectMutation`. This hook is the bridge between
// Effect's failure channel and TanStack's mutation callbacks. The
// branches under test are the runner glue (toast surfacing, defect
// extraction) — not the TanStack Query state machine, which the
// library already covers.

import { makePresenterHarness } from "@/test/presenter-harness";
import { act, renderHook, waitFor } from "@testing-library/react";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QueryDefect, useEffectMutation } from "./use-effect-mutation";

class TaggedA extends Data.TaggedError("TaggedA")<{ readonly message: string }> {}
class TaggedB extends Data.TaggedError("TaggedB")<{ readonly reason: string }> {}

let harness: ReturnType<typeof makePresenterHarness>;

beforeEach(() => {
  harness = makePresenterHarness({ apiClient: {} });
});

afterEach(async () => {
  await harness.dispose();
});

describe("useEffectMutation — success path", () => {
  it("calls toastifySuccess and resolves with the result", async () => {
    const { result } = renderHook(
      () =>
        useEffectMutation({
          mutationKey: ["successful-mutation"],
          mutationFn: () => Effect.succeed({ id: 42 }),
          toastifySuccess: (r) => `created ${r.id}`,
        }),
      { wrapper: harness.wrapper },
    );

    let resolved: { id: number } | undefined;
    await act(async () => {
      resolved = await result.current.mutateAsync(undefined);
    });

    expect(resolved).toEqual({ id: 42 });
    const toasts = await harness.getToasts();
    expect(toasts).toEqual([{ kind: "success", message: "created 42" }]);
  });
});

describe("useEffectMutation — tagged failure", () => {
  it("invokes the matching tag handler and rejects with the tagged error preserved", async () => {
    const { result } = renderHook(
      () =>
        useEffectMutation<never, TaggedA, void, never>({
          mutationKey: ["tagged-failure"],
          mutationFn: () => Effect.fail(new TaggedA({ message: "nope" })),
          toastifyErrors: {
            TaggedA: (e) => `A: ${e.message}`,
          },
        }),
      { wrapper: harness.wrapper },
    );

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync();
      } catch (e) {
        caught = e;
      }
    });

    expect(caught).toBeInstanceOf(TaggedA);
    expect((caught as TaggedA).message).toBe("nope");
    const toasts = await harness.getToasts();
    expect(toasts).toEqual([{ kind: "error", message: "A: nope" }]);
  });

  it("does not invoke an unrelated handler when the tag differs", async () => {
    const { result } = renderHook(
      () =>
        useEffectMutation<never, TaggedA | TaggedB, void, never>({
          mutationKey: ["mismatched-tag"],
          mutationFn: () => Effect.fail(new TaggedB({ reason: "x" })),
          toastifyErrors: {
            TaggedA: (e) => `A: ${e.message}`,
            // No TaggedB handler — falls through to orElse (default: true).
          },
        }),
      { wrapper: harness.wrapper },
    );

    await act(async () => {
      try {
        await result.current.mutateAsync();
      } catch {
        /* tagged failure rejects mutateAsync */
      }
    });

    const toasts = await harness.getToasts();
    // Falls back to DEFAULT_ERROR_MESSAGE (orElse default = true).
    expect(toasts).toEqual([{ kind: "error", message: "Something went wrong" }]);
  });
});

describe("useEffectMutation — orElse fallbacks", () => {
  it("orElse: 'extractMessage' uses error.message when present", async () => {
    const { result } = renderHook(
      () =>
        useEffectMutation<never, TaggedA, void, never>({
          mutationKey: ["orElse-extract"],
          mutationFn: () => Effect.fail(new TaggedA({ message: "extracted!" })),
          toastifyErrors: { orElse: "extractMessage" },
        }),
      { wrapper: harness.wrapper },
    );

    await act(async () => {
      try {
        await result.current.mutateAsync();
      } catch {
        /* expected */
      }
    });

    const toasts = await harness.getToasts();
    expect(toasts).toEqual([{ kind: "error", message: "extracted!" }]);
  });

  it("orElse as a string uses the literal", async () => {
    const { result } = renderHook(
      () =>
        useEffectMutation<never, TaggedA, void, never>({
          mutationKey: ["orElse-literal"],
          mutationFn: () => Effect.fail(new TaggedA({ message: "x" })),
          toastifyErrors: { orElse: "literal fallback" },
        }),
      { wrapper: harness.wrapper },
    );

    await act(async () => {
      try {
        await result.current.mutateAsync();
      } catch {
        /* expected */
      }
    });

    const toasts = await harness.getToasts();
    expect(toasts).toEqual([{ kind: "error", message: "literal fallback" }]);
  });

  it("orElse: false emits no toast on tagged failure", async () => {
    const { result } = renderHook(
      () =>
        useEffectMutation<never, TaggedA, void, never>({
          mutationKey: ["orElse-off"],
          mutationFn: () => Effect.fail(new TaggedA({ message: "silent" })),
          toastifyErrors: { orElse: false },
        }),
      { wrapper: harness.wrapper },
    );

    await act(async () => {
      try {
        await result.current.mutateAsync();
      } catch {
        /* expected */
      }
    });

    const toasts = await harness.getToasts();
    expect(toasts).toEqual([]);
  });
});

describe("useEffectMutation — defects", () => {
  it("wraps a defect in QueryDefect; default defect toast fires with DEFAULT_DEFECT_MESSAGE", async () => {
    const { result } = renderHook(
      () =>
        useEffectMutation({
          mutationKey: ["defect-default"],
          mutationFn: () => Effect.die("kaboom"),
        }),
      { wrapper: harness.wrapper },
    );

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync(undefined);
      } catch (e) {
        caught = e;
      }
    });

    expect(caught).toBeInstanceOf(QueryDefect);
    await waitFor(async () => {
      const toasts = await harness.getToasts();
      expect(toasts).toEqual([{ kind: "error", message: "An unexpected error occurred" }]);
    });
  });

  it("uses the string when toastifyDefects is a string", async () => {
    const { result } = renderHook(
      () =>
        useEffectMutation({
          mutationKey: ["defect-string"],
          mutationFn: () => Effect.die("kaboom"),
          toastifyDefects: "custom defect message",
        }),
      { wrapper: harness.wrapper },
    );

    await act(async () => {
      try {
        await result.current.mutateAsync(undefined);
      } catch {
        /* expected */
      }
    });

    await waitFor(async () => {
      const toasts = await harness.getToasts();
      expect(toasts).toEqual([{ kind: "error", message: "custom defect message" }]);
    });
  });

  it("emits no toast when toastifyDefects: false but still throws QueryDefect", async () => {
    const { result } = renderHook(
      () =>
        useEffectMutation({
          mutationKey: ["defect-silent"],
          mutationFn: () => Effect.die("kaboom"),
          toastifyDefects: false,
        }),
      { wrapper: harness.wrapper },
    );

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync(undefined);
      } catch (e) {
        caught = e;
      }
    });

    expect(caught).toBeInstanceOf(QueryDefect);
    const toasts = await harness.getToasts();
    expect(toasts).toEqual([]);
  });
});
