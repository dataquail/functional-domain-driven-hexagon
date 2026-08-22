import "@testing-library/jest-dom";

import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";
import { afterEach, expect, vi } from "vitest";

import { installMswLifecycle } from "./msw-server";

expect.extend(matchers);

// MSW is installed for the whole suite, not per file. A View that reads a
// reactivity-wrapped query atom can fetch when it mounts however its atoms were
// seeded, so "this test does not need a server" is not a property a test file
// can decide for itself. Intercepting globally means an unexpected request
// fails as an unhandled-request error inside the atom's error channel, rather
// than escaping to whatever happens to be listening on localhost.
installMswLifecycle();

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
