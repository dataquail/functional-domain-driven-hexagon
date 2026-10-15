import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { recordCalls } from "../test/calls";
import Checkbox from "./checkbox.svelte";

describe("Checkbox", () => {
  it("reports the next state when toggled", async () => {
    const onCheckedChange = recordCalls<[boolean]>();
    render(Checkbox, {
      checked: false,
      onCheckedChange: onCheckedChange.callback,
      "aria-label": "Done",
    });

    await userEvent.click(screen.getByRole("checkbox", { name: "Done" }));

    expect(onCheckedChange.calls).toEqual([[true]]);
  });

  it("stays as its owner says when the owner does not take the change", async () => {
    render(Checkbox, { checked: false, onCheckedChange: () => {}, "aria-label": "Done" });

    await userEvent.click(screen.getByRole("checkbox"));

    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "false");
  });

  it("shows the check mark when checked, and refuses input when disabled", async () => {
    const onCheckedChange = recordCalls<[boolean]>();
    render(Checkbox, {
      checked: true,
      disabled: true,
      onCheckedChange: onCheckedChange.callback,
      "aria-label": "Done",
      "data-testid": "checkbox",
    });

    await userEvent.click(screen.getByRole("checkbox"));

    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("checkbox").querySelector("svg")).not.toBeNull();
    expect(onCheckedChange.calls).toHaveLength(0);
  });
});
