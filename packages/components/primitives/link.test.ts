import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import { textSnippet } from "../test/snippets";
import Link from "./link.svelte";

describe("Link", () => {
  it("is an anchor the router may handle, painted from the closed tables", () => {
    render(Link, {
      href: "/todos",
      appearance: "nav-item",
      tone: "muted",
      block: true,
      children: textSnippet("Todos"),
    });

    const link = screen.getByRole("link", { name: "Todos" });
    expect(link).toHaveAttribute("href", "/todos");
    expect(link).not.toHaveAttribute("data-sveltekit-reload");
    expect(link).not.toHaveAttribute("data-sveltekit-preload-data");
    expect(link).toHaveClass("text-muted-foreground", "rounded-md", "block");
  });

  it("asks for a full document load when it leaves the app", () => {
    render(Link, { href: "/api/auth/login", external: true, "aria-label": "Sign in" });

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("data-sveltekit-reload");
  });

  it("states its preload policy only when told one", () => {
    render(Link, { href: "/a", prefetch: true, "data-testid": "eager" });
    render(Link, { href: "/b", prefetch: false, "data-testid": "lazy" });

    expect(screen.getByTestId("eager")).toHaveAttribute("data-sveltekit-preload-data", "hover");
    expect(screen.getByTestId("lazy")).toHaveAttribute("data-sveltekit-preload-data", "off");
  });
});
