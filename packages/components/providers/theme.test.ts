import { render, screen } from "@testing-library/svelte";
import * as Option from "effect/Option";
import { afterEach, describe, expect, it } from "vitest";

import { textSnippet } from "../test/snippets";
import { ThemeState, type ThemeStorage } from "./theme.svelte";
import ThemeProvider from "./theme-provider.svelte";

const memoryStorage = (initial: ReadonlyArray<readonly [string, string]> = []) => {
  const entries = new Map(initial);

  const storage: ThemeStorage = {
    getItem: (key) => Option.getOrNull(Option.fromUndefinedOr(entries.get(key))),
    setItem: (key, value) => {
      entries.set(key, value);
    },
  };

  return () => storage;
};

afterEach(() => {
  document.documentElement.classList.remove("light", "dark");
});

describe("ThemeState", () => {
  it("resolves the system theme through the media query", () => {
    expect(new ThemeState("system", "theme", memoryStorage()).actualTheme).toBe("light");
    expect(new ThemeState("dark", "theme", memoryStorage()).actualTheme).toBe("dark");
  });

  it("persists a chosen theme and restores it", () => {
    const storage = memoryStorage();
    new ThemeState("system", "theme", storage).setTheme("dark");

    const restored = new ThemeState("system", "theme", storage);
    restored.restore();

    expect(restored.theme).toBe("dark");
  });

  it("ignores a stored value that is not a theme", () => {
    const state = new ThemeState("light", "theme", memoryStorage([["theme", "sepia"]]));
    state.restore();

    expect(state.theme).toBe("light");
  });
});

describe("ThemeProvider", () => {
  it("renders its children and puts the resolved theme on the document", async () => {
    render(ThemeProvider, {
      storage: memoryStorage([["web-ui-theme", "dark"]]),
      children: textSnippet("App"),
    });

    expect(screen.getByText("App")).toBeInTheDocument();
    await expect.poll(() => document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("falls back to its default theme", async () => {
    render(ThemeProvider, {
      defaultTheme: "light",
      storageKey: "other",
      storage: memoryStorage(),
      children: textSnippet("App"),
    });

    await expect.poll(() => document.documentElement.classList.contains("light")).toBe(true);
  });
});
