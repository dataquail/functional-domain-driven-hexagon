import "@testing-library/jest-dom";
import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";
import { afterEach, expect, vi } from "vitest";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

// jsdom doesn't implement `matchMedia`; ThemeProvider reads it on mount.
// Stub a "light" matcher so the integration harness renders without
// throwing. Per-component tests that need a different result can
// override `window.matchMedia` directly. Always define — the property
// may be present as `undefined` in some jsdom modes, and the check
// `in window` is unreliable across vitest workspace vs. package-scoped
// runs.
Object.defineProperty(globalThis, "matchMedia", {
  writable: true,
  configurable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
