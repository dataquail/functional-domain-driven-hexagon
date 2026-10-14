import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";
import * as matchers from "@testing-library/jest-dom/matchers";
import { expect } from "vitest";

// jest-dom's own vitest typings augment a one-parameter `Assertion`; vitest 5's takes two.
declare module "vitest" {
  /* oxlint-disable typescript/consistent-type-definitions, typescript/no-empty-interface, typescript/no-empty-object-type -- augmenting vitest's Matchers needs an interface that merges */
  interface Matchers<
    R extends void | Promise<void> = void | Promise<void>,
    T = unknown,
  > extends TestingLibraryMatchers<unknown, R> {}
  /* oxlint-enable typescript/consistent-type-definitions, typescript/no-empty-interface, typescript/no-empty-object-type */
}

expect.extend(matchers);

// jsdom has no media queries; the toaster and the theme ask for one.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Nor pointer capture or scrolling, which the select's pointer handling calls.
Element.prototype.hasPointerCapture = () => false;

Element.prototype.releasePointerCapture = () => {};

Element.prototype.scrollIntoView = () => {};
