import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { textSnippet } from "../test/snippets";
import Button from "./button.svelte";

describe("Button", () => {
  it("is a plain button that reports a click", async () => {
    const onClick = vi.fn();
    render(Button, { onClick, children: textSnippet("Save") });

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("does not report a click while disabled", async () => {
    const onClick = vi.fn();
    render(Button, { onClick, disabled: true, children: textSnippet("Save") });

    await userEvent.click(screen.getByRole("button"));

    expect(onClick).not.toHaveBeenCalled();
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
