import { render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";

import { textSnippet } from "../test/snippets";
import { ThemeState } from "./theme.svelte";
import ThemeProvider from "./theme-provider.svelte";

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove("light", "dark");
});

describe("ThemeState", () => {
  it("resolves the system theme through the media query", () => {
    expect(new ThemeState("system", "theme").actualTheme).toBe("light");
    expect(new ThemeState("dark", "theme").actualTheme).toBe("dark");
  });

  it("persists a chosen theme and restores it", () => {
    new ThemeState("system", "theme").setTheme("dark");

    const restored = new ThemeState("system", "theme");
    restored.restore();

    expect(restored.theme).toBe("dark");
  });

  it("ignores a stored value that is not a theme", () => {
    window.localStorage.setItem("theme", "sepia");

    const state = new ThemeState("light", "theme");
    state.restore();

    expect(state.theme).toBe("light");
  });
});

describe("ThemeProvider", () => {
  it("renders its children and puts the resolved theme on the document", async () => {
    window.localStorage.setItem("web-ui-theme", "dark");

    render(ThemeProvider, { children: textSnippet("App") });

    expect(screen.getByText("App")).toBeInTheDocument();
    await expect.poll(() => document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("falls back to its default theme", async () => {
    render(ThemeProvider, {
      defaultTheme: "light",
      storageKey: "other",
      children: textSnippet("App"),
    });

    await expect.poll(() => document.documentElement.classList.contains("light")).toBe(true);
  });
});
