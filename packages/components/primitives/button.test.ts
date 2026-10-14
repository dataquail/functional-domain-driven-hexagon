import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { recordCalls } from "../test/calls";
import { textSnippet } from "../test/snippets";
import Button from "./button.svelte";

describe("Button", () => {
  it("is a plain button that reports a click", async () => {
    const onClick = recordCalls();
    render(Button, { onClick: onClick.callback, children: textSnippet("Save") });

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onClick.calls).toHaveLength(1);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("does not report a click while disabled", async () => {
    const onClick = recordCalls();
    render(Button, { onClick: onClick.callback, disabled: true, children: textSnippet("Save") });

    await userEvent.click(screen.getByRole("button"));

    expect(onClick.calls).toHaveLength(0);
  });

  it("shows a spinner while loading, and paints from the closed tables", () => {
    render(Button, {
      loading: true,
      type: "submit",
      variant: "destructive",
      size: "icon",
      width: "full",
      "aria-label": "Delete",
    });

    const button = screen.getByRole("button", { name: "Delete" });
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toHaveClass("bg-destructive", "size-9", "w-full");
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
