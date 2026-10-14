import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import { textSnippet } from "../../test/snippets";
import { Card } from "./card";

describe("Card", () => {
  it("owns its chrome, from the closed tables", () => {
    render(Card, { elevation: "md", interactive: "raise", "data-testid": "card" });

    expect(screen.getByTestId("card")).toHaveClass("rounded-xl", "shadow-md", "hover:shadow-md");
  });

  it("lays out its header, content and footer", () => {
    const { container } = render(Card.Header, {
      padding: "tight",
      children: textSnippet("Header"),
    });

    render(Card.Content, { gap: "lg", children: textSnippet("Content") });
    render(Card.Footer, { children: textSnippet("Footer") });

    expect(container.querySelector('[data-slot="card-header"]')).toHaveClass("pb-2");
    expect(screen.getByText("Content").parentElement).toHaveClass("space-y-4");
    expect(screen.getByText("Footer").parentElement).toHaveClass("p-6");
  });
});
