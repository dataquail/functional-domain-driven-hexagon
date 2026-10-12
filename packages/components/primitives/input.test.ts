import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import Input from "./input.svelte";

describe("Input", () => {
  it("reports each edit as the next value", async () => {
    const onValueChange = vi.fn();
    render(Input, { value: "", onValueChange, "aria-label": "Title" });

    await userEvent.type(screen.getByRole("textbox", { name: "Title" }), "a");

    expect(onValueChange).toHaveBeenCalledWith("a");
  });

  it("undoes an edit its owner does not take", async () => {
    render(Input, { value: "fixed", onValueChange: () => {}, "aria-label": "Title" });

    await userEvent.type(screen.getByRole("textbox"), "x");

    expect(screen.getByRole("textbox")).toHaveValue("fixed");
  });

  it("marks itself invalid and carries the form attributes", () => {
    render(Input, {
      value: "",
      onValueChange: () => {},
      type: "email",
      name: "email",
      required: true,
      invalid: true,
      autoComplete: "email",
      placeholder: "you@example.com",
      "aria-label": "Email",
    });

    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("type", "email");
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("autocomplete", "email");
  });
});
