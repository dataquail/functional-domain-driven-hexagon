import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import FormRoot from "./form.svelte";
import FieldError from "./form-error.part.svelte";
import { Form } from "./index";

describe("Form", () => {
  it("reports a submit with the browser's default already prevented", async () => {
    const onSubmit = vi.fn();
    render(FormRoot, { onSubmit, "data-testid": "form" });

    const submitted = new Event("submit", { bubbles: true, cancelable: true });
    await fireEvent(screen.getByTestId("form"), submitted);

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(submitted.defaultPrevented).toBe(true);
  });

  it("gathers the field primitives on the form", () => {
    expect(Object.keys(Form).sort()).toEqual(["Control", "Error", "Input", "Label", "Select"]);
  });
});

describe("Form.Error", () => {
  it("announces an error", () => {
    render(FieldError, { error: "Email is required", "data-testid": "error" });

    expect(screen.getByRole("alert")).toHaveTextContent("Email is required");
  });

  it("renders nothing for no error or an empty one", () => {
    render(FieldError, { error: null });
    render(FieldError, { error: "" });

    expect(screen.queryByRole("alert")).toBeNull();
  });
});
