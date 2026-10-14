import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import { textSnippet } from "../test/snippets";
import Badge from "./badge.svelte";

describe("Badge", () => {
  it("renders its label in the default variant", () => {
    render(Badge, { children: textSnippet("Active"), "data-testid": "badge" });

    expect(screen.getByTestId("badge")).toHaveTextContent("Active");
    expect(screen.getByTestId("badge")).toHaveClass("bg-primary", "text-xs");
  });

  it("maps each variant through its class table", () => {
    render(Badge, { variant: "outline", "data-testid": "badge" });

    expect(screen.getByTestId("badge")).toHaveClass("text-foreground");
    expect(screen.getByTestId("badge")).not.toHaveClass("bg-primary");
  });
});
