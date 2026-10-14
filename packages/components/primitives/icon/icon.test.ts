import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import { CheckIcon, PlusIcon } from "./icon";

describe("an icon from createIcon", () => {
  it("is decorative by default, sized and toned from the closed tables", () => {
    render(PlusIcon, { "data-testid": "icon" });

    const icon = screen.getByTestId("icon");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).toHaveClass("size-4");
  });

  it("follows its props when they change", async () => {
    const { rerender } = render(CheckIcon, { size: "sm", tone: "muted", "data-testid": "icon" });
    expect(screen.getByTestId("icon")).toHaveClass("size-3", "text-muted-foreground");

    await rerender({ size: "lg", tone: "destructive", "data-testid": "icon" });

    expect(screen.getByTestId("icon")).toHaveClass("size-5", "text-destructive");
  });

  it("can be labelled instead of hidden", () => {
    render(CheckIcon, { "aria-hidden": false, "aria-label": "Done" });

    expect(screen.getByLabelText("Done")).toHaveAttribute("aria-hidden", "false");
  });
});
