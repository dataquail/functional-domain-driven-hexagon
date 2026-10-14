import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import { Grid } from "./grid";

describe("Grid", () => {
  it("is one column on small screens and N above", () => {
    render(Grid, { columnsAbove: 3, gap: "lg", "data-testid": "grid" });

    expect(screen.getByTestId("grid")).toHaveClass("grid-cols-1", "sm:grid-cols-3", "gap-4");
  });

  it("lets an item span columns above the breakpoint", () => {
    render(Grid.Item, { spanAbove: 2, "data-testid": "item" });

    expect(screen.getByTestId("item")).toHaveClass("sm:col-span-2");
  });
});
