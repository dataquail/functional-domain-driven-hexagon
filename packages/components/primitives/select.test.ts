import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { recordCalls } from "../test/calls";
import Select from "./select.svelte";

const ITEMS = [
  { value: "acme", label: "Acme", "data-testid": "org-acme" },
  { value: "globex", label: "Globex" },
  { value: "initech", label: "Initech", disabled: true },
];

describe("Select", () => {
  it("shows the selected item's label while closed", () => {
    render(Select, {
      value: "globex",
      onValueChange: () => {},
      items: ITEMS,
      "data-testid": "trigger",
    });

    expect(screen.getByTestId("trigger")).toHaveTextContent("Globex");
  });

  it("shows the placeholder when nothing is selected", () => {
    render(Select, {
      onValueChange: () => {},
      items: ITEMS,
      placeholder: "Select an organization…",
      width: "md",
      "data-testid": "trigger",
    });

    expect(screen.getByTestId("trigger")).toHaveTextContent("Select an organization…");
    expect(screen.getByTestId("trigger")).toHaveClass("w-50");
  });

  it("reports the item picked from the open list", async () => {
    const onValueChange = recordCalls<[string]>();
    render(Select, {
      value: "globex",
      onValueChange: onValueChange.callback,
      items: ITEMS,
      "aria-label": "Organization",
    });

    await userEvent.click(screen.getByRole("button", { name: "Organization" }));
    await userEvent.click(await screen.findByTestId("org-acme"));

    expect(onValueChange.calls).toEqual([["acme"]]);
  });
});
