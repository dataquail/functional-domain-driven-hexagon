import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import { textSnippet } from "../test/snippets";
import Label from "./label.svelte";

describe("Label", () => {
  it("names the control it is for and marks a required field", () => {
    render(Label, {
      htmlFor: "email",
      required: true,
      children: textSnippet("Email"),
      "data-testid": "label",
    });

    const label = screen.getByTestId("label");
    expect(label).toHaveAttribute("for", "email");
    expect(label).toHaveClass("cursor-pointer");
    expect(label).toHaveTextContent(/^Email\s*\*$/);
  });

  it("strikes a completed item through and clips it to one line", () => {
    render(Label, {
      tone: "muted",
      decoration: "line-through",
      truncate: true,
      "data-testid": "label",
    });

    expect(screen.getByTestId("label")).toHaveClass(
      "text-muted-foreground",
      "line-through",
      "truncate",
    );
    expect(screen.getByTestId("label")).not.toHaveClass("cursor-pointer");
  });
});
