import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import { textSnippet } from "../test/snippets";
import Heading from "./heading.svelte";
import Reveal from "./reveal.svelte";
import Skeleton from "./skeleton.svelte";
import Text from "./text.svelte";

describe("Heading", () => {
  it("is an h2 by default", () => {
    render(Heading, { children: textSnippet("Organizations") });

    expect(screen.getByRole("heading", { level: 2, name: "Organizations" })).toHaveClass("text-xl");
  });

  it("sets its outline level independently of its size", () => {
    render(Heading, {
      level: 1,
      size: "sm",
      tone: "muted",
      align: "center",
      "data-testid": "heading",
    });

    const heading = screen.getByTestId("heading");
    expect(heading.tagName).toBe("H1");
    expect(heading).toHaveClass("text-sm", "text-muted-foreground", "text-center");
  });
});

describe("Text", () => {
  it("is a small paragraph by default", () => {
    render(Text, { "data-testid": "text" });

    expect(screen.getByTestId("text").tagName).toBe("P");
    expect(screen.getByTestId("text")).toHaveClass("text-sm", "text-foreground", "font-normal");
  });

  it("maps its type props through the closed tables", () => {
    render(Text, {
      as: "span",
      size: "lg",
      tone: "destructive",
      weight: "semibold",
      align: "end",
      truncate: true,
      "data-testid": "text",
    });

    expect(screen.getByTestId("text").tagName).toBe("SPAN");
    expect(screen.getByTestId("text")).toHaveClass(
      "text-lg",
      "text-destructive",
      "font-semibold",
      "text-end",
      "truncate",
    );
  });

  it("can be heard and not seen", () => {
    render(Text, { srOnly: true, tone: "muted", "data-testid": "text" });

    expect(screen.getByTestId("text").className).toBe("sr-only");
  });
});

describe("Skeleton", () => {
  it("is a hidden placeholder sized from closed sets", () => {
    render(Skeleton, { height: "row", width: "switcher", radius: "lg", "data-testid": "skeleton" });

    expect(screen.getByTestId("skeleton")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("skeleton")).toHaveClass(
      "h-14",
      "w-50",
      "rounded-lg",
      "animate-pulse",
    );
  });
});

describe("Reveal", () => {
  it("stays in the tree and fades in with its group", () => {
    render(Reveal, { children: textSnippet("Delete"), "data-testid": "reveal" });

    expect(screen.getByTestId("reveal")).toHaveTextContent("Delete");
    expect(screen.getByTestId("reveal")).toHaveClass("opacity-0", "group-hover:opacity-100");
  });
});
