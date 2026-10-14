import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import Container from "./container.svelte";
import Nav from "./nav.svelte";
import Stack from "./stack.svelte";
import Surface from "./surface.svelte";

describe("Container", () => {
  it("is a centred, width-capped column", () => {
    render(Container, { "data-testid": "container" });

    expect(screen.getByTestId("container").tagName).toBe("DIV");
    expect(screen.getByTestId("container")).toHaveClass("mx-auto", "max-w-3xl", "px-4");
  });

  it("takes its element, width and padding from closed sets", () => {
    render(Container, {
      as: "main",
      width: "xs",
      paddingX: "none",
      paddingY: "lg",
      "data-testid": "container",
    });

    expect(screen.getByTestId("container").tagName).toBe("MAIN");
    expect(screen.getByTestId("container")).toHaveClass("max-w-md", "py-12");
    expect(screen.getByTestId("container")).not.toHaveClass("px-4");
  });
});

describe("Stack", () => {
  it("is a column with no gap by default", () => {
    render(Stack, { "data-testid": "stack" });

    expect(screen.getByTestId("stack")).toHaveClass("flex", "flex-col", "gap-0", "items-stretch");
  });

  it("maps every layout prop through its class table", () => {
    render(Stack, {
      as: "header",
      direction: "row",
      directionAbove: "column",
      gap: "xl",
      align: "center",
      justify: "between",
      width: "full",
      paddingY: "md",
      minHeight: "screen",
      wrap: true,
      grow: true,
      shrinkBelowContent: true,
      "data-testid": "stack",
    });

    const stack = screen.getByTestId("stack");
    expect(stack.tagName).toBe("HEADER");
    expect(stack).toHaveClass(
      "flex-row",
      "sm:flex-col",
      "gap-6",
      "items-center",
      "justify-between",
      "w-full",
      "py-8",
      "min-h-screen",
      "flex-wrap",
      "flex-1",
      "min-w-0",
    );
  });
});

describe("Surface", () => {
  it("is an unpainted div by default", () => {
    render(Surface, { "data-testid": "surface" });

    expect(screen.getByTestId("surface").tagName).toBe("DIV");
    expect(screen.getByTestId("surface").className).toBe("");
  });

  it("paints a bordered, padded region and can be a hover group", () => {
    render(Surface, {
      as: "li",
      tone: "card",
      radius: "md",
      border: "all",
      padding: "md",
      interactive: "raise",
      hoverGroup: true,
      "data-testid": "surface",
    });

    const surface = screen.getByTestId("surface");
    expect(surface.tagName).toBe("LI");
    expect(surface).toHaveClass(
      "group",
      "bg-card",
      "rounded-md",
      "border",
      "p-3",
      "hover:shadow-sm",
    );
  });
});

describe("Nav", () => {
  it("is a horizontal nav landmark by default, and a bar when asked", () => {
    render(Nav, { tone: "bar", "aria-label": "Primary" });
    render(Nav, { orientation: "vertical", "aria-label": "Settings" });

    expect(screen.getByRole("navigation", { name: "Primary" })).toHaveClass("flex-row", "border-b");
    expect(screen.getByRole("navigation", { name: "Settings" })).toHaveClass("flex-col");
  });
});
