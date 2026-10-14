import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import Spinner from "./spinner.svelte";

describe("Spinner", () => {
  it("announces its label as a status while the ring stays decorative", () => {
    render(Spinner, { label: "Saving" });

    expect(screen.getByRole("status")).toHaveTextContent("Saving");
    expect(screen.getByRole("status").querySelector("[aria-hidden='true']")).toHaveClass(
      "animate-spin",
      "size-6",
      "text-muted-foreground",
    );
  });

  it("maps its size and tone through the closed class tables", () => {
    render(Spinner, { size: "lg", tone: "inherit", "data-testid": "spinner" });

    const ring = screen.getByTestId("spinner").querySelector("[aria-hidden='true']");
    expect(ring).toHaveClass("size-8", "border-[3px]");
    expect(ring).not.toHaveClass("text-muted-foreground");
  });
});
